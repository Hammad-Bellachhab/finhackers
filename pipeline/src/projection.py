"""Proyección de la salud a 6 meses: montecarlo empírico sobre empresas comparables.

Lo que había antes era una recta: OLS sobre los últimos 6 meses de salud suavizada y una banda
±1,96·σ·√k alrededor. Tres problemas, y los tres se ven en la demo: la recta no se para nunca (una
empresa que baja 3 puntos al mes acaba en 0 a los seis meses, cosa que en el panel no le pasa a
casi nadie), la banda es una fórmula de libro de texto que no estaba medida contra nada, y en todo
el cálculo no entraba ni un resultado del modelo.

Aquí las trayectorias no se inventan: se muestrean. Para una empresa en un estado dado (nivel de
salud, sorpresa del último mes, inercia a 1 y a 3 meses — todo derivado de la probabilidad
calibrada que saca el modelo) se buscan los meses-empresa del panel que estaban en ese mismo
estado, se pesan por parecido con un núcleo gaussiano estrecho (mandan los muy parecidos) y se
sortean 2.000 trayectorias completas de 6 meses de las que de verdad ocurrieron después. La banda
es el percentil 10-90 de esas 2.000 trayectorias.

Ventajas sobre la recta, todas comprobables en `reports/projection_backtest.json`:
  · la reversión a la media sale sola (las empresas que caían fuerte, de media, dejan de caer);
  · la banda es asimétrica cuando la realidad lo es (desde salud 40 se puede subir más que bajar);
  · la anchura está medida: se sabe qué porcentaje de los meses cae dentro, y en empresas que el
    modelo no vio.

`python -m src.projection` mide la cobertura contra las empresas reservadas y escribe el informe.
"""
from __future__ import annotations

import json
from dataclasses import dataclass

import numpy as np
import pandas as pd

from src import config as C

HORIZON = 6               # meses proyectados
N_PATHS = 2000            # trayectorias sorteadas por empresa
K_NEIGHBOURS = 400        # meses-empresa candidatos antes de pesar por parecido
BW = 0.25                 # anchura del nucleo, en desviaciones tipicas del estado
MIN_NEAR = 40             # vecinos minimos: si no hay tantos de cerca, el nucleo se ensancha
MIN_HISTORY = 4           # meses necesarios para que la inercia a 3 meses sea real
LOW_Q, HIGH_Q = 0.10, 0.90   # banda del 80 % (la que se pinta)
# Peso de cada dimensión del estado: nivel, sorpresa del mes, inercia 1 m, inercia 3 m.
# El nivel pesa el doble que el resto, y no por intuición: con peso 1 la banda cubría el 79,0 % de
# lo que pasó y el 69,7 % en las empresas en riesgo; con peso 2, el 80,9 % y el 71,7 %. Una empresa
# a 35 de salud y otra a 75 pueden caer igual de rápido, pero lo que les pasa después no se parece.
DIM_WEIGHT = np.array([2.0, 0.7, 0.9, 0.9])
STATE_DIMS = ("health_smooth", "surprise", "delta_1m", "delta_3m")


@dataclass(frozen=True)
class Pool:
    """Los meses-empresa del panel con 6 meses de futuro conocido: estado + lo que pasó después."""
    state: np.ndarray      # (n, 4) estado en T
    delta: np.ndarray      # (n, HORIZON) salud suavizada en T+k menos la de T
    company: np.ndarray    # (n,) empresa de la que sale cada trayectoria
    month: np.ndarray      # (n,) mes T
    scale: np.ndarray      # (4,) desviación típica de cada dimensión, para comparar peras con peras

    def __len__(self) -> int:
        return len(self.delta)


def state_of(health: np.ndarray, smooth: np.ndarray) -> np.ndarray:
    """Estado mes a mes de una empresa: (nivel, sorpresa del mes, inercia 1 m, inercia 3 m).

    'sorpresa' = salud sin suavizar menos suavizada: lo que el modelo ha dicho este mes y la EMA
    todavía no se ha creído. Es el aviso más temprano que hay en la serie.
    """
    n = len(smooth)
    d1 = np.zeros(n)
    d1[1:] = smooth[1:] - smooth[:-1]
    d3 = np.zeros(n)
    if n > 3:
        d3[3:] = smooth[3:] - smooth[:-3]
    return np.column_stack([smooth, health - smooth, d1, d3])


def build_pool(df: pd.DataFrame, horizon: int = HORIZON) -> Pool:
    """df con company_id, T, health y health_smooth (tal cual sale de risk_score)."""
    S, D, cid_, M = [], [], [], []
    for cid, g in df.sort_values(["company_id", "T"]).groupby("company_id", sort=False):
        smooth = g["health_smooth"].to_numpy(float)
        st = state_of(g["health"].to_numpy(float), smooth)
        months = g["T"].to_numpy()
        # Desde MIN_HISTORY-1 para que la inercia no sea un cero de relleno, y hasta donde haya
        # 6 meses de futuro observado: una trayectoria a medias no es una trayectoria.
        for i in range(MIN_HISTORY - 1, len(smooth) - horizon):
            S.append(st[i])
            D.append(smooth[i + 1:i + 1 + horizon] - smooth[i])
            cid_.append(cid)
            M.append(months[i])
    if not S:
        raise ValueError("no hay ningún mes-empresa con 6 meses de futuro: el panel es demasiado corto")
    state = np.asarray(S, dtype=float)
    return Pool(state, np.asarray(D, dtype=float), np.asarray(cid_), np.asarray(M),
                np.maximum(state.std(axis=0), 1e-6))


def fan(pool: Pool, state: np.ndarray, exclude_company: str | None = None,
        n_paths: int = N_PATHS, k: int = K_NEIGHBOURS, bw: float = BW,
        min_near: int = MIN_NEAR, seed: int = C.SEED) -> dict:
    """Sortea n_paths trayectorias de los meses-empresa más parecidos y devuelve la mediana y la banda.

    `exclude_company` saca del sorteo los meses de la propia empresa: proyectar su futuro con su
    futuro sería hacer trampas, y además dejaría la banda absurdamente estrecha.
    """
    keep = pool.company != exclude_company if exclude_company is not None else np.ones(len(pool), bool)
    deltas = pool.delta[keep]
    d = (pool.state[keep] - np.asarray(state, dtype=float)) / pool.scale * DIM_WEIGHT
    dist = np.sqrt((d * d).sum(axis=1))
    k = min(k, len(dist))
    idx = np.argpartition(dist, k - 1)[:k]
    idx = idx[np.argsort(dist[idx], kind="stable")]        # orden estable → resultado reproducible
    near = dist[idx]

    # Núcleo gaussiano de anchura fija en desviaciones típicas del estado: los muy parecidos se
    # llevan casi todo el peso y el resto solo aporta la cola. Si en ese radio no hay ni min_near
    # vecinos (empresas raras, muy arriba o muy abajo), el núcleo se ensancha hasta alcanzarlos:
    # antes una banda estrecha sostenida por cuatro vecinos que una banda falsamente segura.
    bw = max(bw, float(near[min(min_near, k) - 1]), 1e-6)
    w = np.exp(-0.5 * (near / bw) ** 2)
    total = w.sum()
    w = np.full(k, 1.0 / k) if total <= 0 else w / total

    rng = np.random.default_rng(seed)
    paths = np.clip(float(state[0]) + deltas[idx][rng.choice(k, size=n_paths, p=w)], 0.0, 100.0)
    lo, mid, hi = np.quantile(paths, [LOW_Q, 0.5, HIGH_Q], axis=0)
    h0 = float(state[0])
    risk_cut = next(hi_ for lo_, hi_, name in C.HEALTH_BANDS if name == "riesgo")
    return {
        "median": mid, "low": lo, "high": hi,
        "nPaths": n_paths,
        # tamaño muestral efectivo: cuántos vecinos "de verdad" sostienen la banda
        "nNeighbours": int(round(1.0 / float((w ** 2).sum()))),
        "nCompanies": int(len(np.unique(pool.company[keep][idx[w > w.max() / 100]]))),
        "probDrop5": float((paths[:, -1] <= h0 - 5).mean()),
        "probRisk": float((paths[:, -1] < risk_cut).mean()),
    }


def fan_for(pool: Pool, h: pd.DataFrame, cid: str | None = None, **kw) -> dict:
    """Atajo: proyecta el último mes del histórico de una empresa (columnas health, health_smooth)."""
    st = state_of(h["health"].to_numpy(float), h["health_smooth"].to_numpy(float))[-1]
    return fan(pool, st, exclude_company=cid, **kw)


# --------------------------------------------------------------------------------------
# Backtest: ¿la banda contiene lo que pasó después?
# --------------------------------------------------------------------------------------
def ols_fan(smooth: np.ndarray, horizon: int = HORIZON) -> dict:
    """El método anterior (recta + ±1,96·σ·√k), para comparar contra algo y no contra nada."""
    y = smooth[-6:]
    x = np.arange(len(y), dtype=float)
    slope, icpt = np.polyfit(x, y, 1) if len(y) > 1 else (0.0, y[-1])
    sigma = max(float(np.std(y - (slope * x + icpt))), 2.0)
    k = np.arange(1, horizon + 1)
    mid = np.clip(y[-1] + slope * k, 0, 100)
    w = 1.96 * sigma * np.sqrt(k)
    return {"median": mid, "low": np.maximum(0, mid - w), "high": np.minimum(100, mid + w)}


def backtest(df: pd.DataFrame, test_ids: set[str], horizon: int = HORIZON) -> dict:
    """Cobertura y error de la banda en las empresas que el modelo nunca vio.

    El pool se construye SOLO con empresas de entrenamiento: si las reservadas entraran, la
    proyección de una de ellas podría apoyarse en sus hermanas de test y el número saldría mejor
    de lo que es. En producción el pool sí las incluye (más datos), así que esto es la cota baja.
    """
    pool = build_pool(df[~df["company_id"].isin(test_ids)], horizon)
    hit_mc = np.zeros(horizon); hit_ols = np.zeros(horizon)
    err_mc = np.zeros(horizon); err_ols = np.zeros(horizon)
    width_mc = np.zeros(horizon); width_ols = np.zeros(horizon)
    n = 0
    by_band: dict[str, list[tuple[float, float, float]]] = {}
    test = df[df["company_id"].isin(test_ids)].sort_values(["company_id", "T"])
    for cid, g in test.groupby("company_id", sort=False):
        smooth = g["health_smooth"].to_numpy(float)
        st = state_of(g["health"].to_numpy(float), smooth)
        for i in range(MIN_HISTORY - 1, len(smooth) - horizon):
            actual = smooth[i + 1:i + 1 + horizon]
            mc = fan(pool, st[i])
            for f, hit, err, width in ((mc, hit_mc, err_mc, width_mc),
                                       (ols_fan(smooth[:i + 1], horizon), hit_ols, err_ols, width_ols)):
                hit += (actual >= f["low"]) & (actual <= f["high"])
                err += np.abs(f["median"] - actual)
                width += f["high"] - f["low"]
            # Por banda de salud de partida: la media global esconde que las empresas en riesgo,
            # que son las que importan, tienen un futuro bastante más impredecible que el resto.
            band = next(name for lo, hi, name in C.HEALTH_BANDS if lo <= st[i, 0] < hi)
            by_band.setdefault(band, []).append((
                float(((actual >= mc["low"]) & (actual <= mc["high"])).mean()),
                float(np.abs(mc["median"] - actual).mean()), float((mc["high"] - mc["low"]).mean())))
            n += 1
    if n == 0:
        raise ValueError("ninguna empresa reservada tiene 6 meses de futuro para comprobar")
    r = lambda a: [round(float(v), 3) for v in a / n]
    bands = {b: {"n": len(v), "coverage": round(float(np.mean([x[0] for x in v])), 3),
                 "mae": round(float(np.mean([x[1] for x in v])), 2),
                 "band_width": round(float(np.mean([x[2] for x in v])), 1)}
             for b, v in sorted(by_band.items(), key=lambda kv: -len(kv[1]))}
    return {
        "n_test_companies": int(test["company_id"].nunique()), "n_forecasts": int(n), "horizon": horizon,
        "interval": int(round(100 * (HIGH_Q - LOW_Q))), "n_pool": int(len(pool)),
        "montecarlo": {"coverage_by_month": r(hit_mc), "coverage": round(float(hit_mc.sum() / (n * horizon)), 3),
                       "mae_by_month": r(err_mc), "mae": round(float(err_mc.sum() / (n * horizon)), 2),
                       "band_width": round(float(width_mc.sum() / (n * horizon)), 1),
                       "by_health_band": bands},
        "ols_baseline": {"coverage_by_month": r(hit_ols), "coverage": round(float(hit_ols.sum() / (n * horizon)), 3),
                         "mae_by_month": r(err_ols), "mae": round(float(err_ols.sum() / (n * horizon)), 2),
                         "band_width": round(float(width_ols.sum() / (n * horizon)), 1)},
    }


def coverage() -> float | None:
    """Cobertura medida que se enseña en el front; None si nadie ha corrido el backtest todavía."""
    p = C.REPORTS_DIR / "projection_backtest.json"
    if not p.exists():
        return None
    return float(json.loads(p.read_bytes().decode("utf-8", errors="replace"))["montecarlo"]["coverage"])


def run() -> None:
    from src.api import db

    df = db.q('SELECT company_id, "T", health, health_smooth FROM risk_score ORDER BY company_id, "T"')
    out = backtest(df, set(C.test_company_ids()))
    path = C.REPORTS_DIR / "projection_backtest.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    mc, ols = out["montecarlo"], out["ols_baseline"]
    print(f"[projection] {out['n_forecasts']} proyecciones sobre {out['n_test_companies']} empresas reservadas "
          f"(pool: {out['n_pool']} meses-empresa)")
    print(f"[projection] banda del {out['interval']} % — montecarlo: cobertura {mc['coverage']:.1%}, "
          f"MAE {mc['mae']:.2f} pt, anchura {mc['band_width']:.1f} pt")
    print(f"[projection] recta anterior      — cobertura {ols['coverage']:.1%}, "
          f"MAE {ols['mae']:.2f} pt, anchura {ols['band_width']:.1f} pt")
    print(f"[projection] informe en {path}")


if __name__ == "__main__":
    import sys

    sys.stdout.reconfigure(encoding="utf-8")
    run()
