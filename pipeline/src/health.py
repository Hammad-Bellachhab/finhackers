"""Score de salud bidireccional y trayectoria (reto X-Ray, preguntas 1-5).

Entrada: probabilidad calibrada de deterioro p por (empresa, T). Salida, por (empresa, T):
    health            100 · (1 − p)                       → nivel
    health_smooth     EMA(health)                         → estabilidad (un mes malo no cambia la lectura)
    delta_1m/3m       cambio de la salud suavizada        → dirección
    trajectory        mejorando / estable / deteriorándose (requiere 3 m de cambio y consistencia)
    is_blip           bache puntual: caída de un mes recuperada al siguiente
    is_structural     caída estructural: "deteriorándose" durante >= 3 meses seguidos
    is_exceptional    excepcionalmente sólida: salud >= 90 durante >= 6 meses seguidos
    band              sólida / sana / vigilar / riesgo (por salud suavizada)

Las mismas reglas las usan serve_db.py (dashboard) y predict.py (test oculto). Todas están en config.py.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from src import config as C


def health_band(h: float) -> str:
    for lo, hi, name in C.HEALTH_BANDS:
        if lo <= h < hi:
            return name
    return C.HEALTH_BANDS[-1][2]


def _ema(x: np.ndarray, alpha: float) -> np.ndarray:
    out = np.empty_like(x, dtype=float)
    acc = np.nan
    for i, v in enumerate(x):
        if np.isnan(v):
            out[i] = acc
            continue
        acc = v if np.isnan(acc) else alpha * v + (1 - alpha) * acc
        out[i] = acc
    return out


def _trajectory(d3: float, last_deltas: np.ndarray) -> str:
    ok = last_deltas[~np.isnan(last_deltas)]
    if np.isnan(d3) or len(ok) == 0:
        return "estable"
    if d3 <= -C.TRAJ_DELTA_3M and (ok < 0).sum() >= min(C.TRAJ_MIN_CONSISTENT, len(ok)):
        return "deteriorándose"
    if d3 >= C.TRAJ_DELTA_3M and (ok > 0).sum() >= min(C.TRAJ_MIN_CONSISTENT, len(ok)):
        return "mejorando"
    return "estable"


def add_health(df: pd.DataFrame, p_col: str = "score") -> pd.DataFrame:
    """df con columnas company_id, T (YYYY-MM) y p_col. Devuelve df + columnas de salud/trayectoria."""
    df = df.sort_values(["company_id", "T"]).copy()
    df["health"] = 100 * (1 - df[p_col].astype(float))
    parts = []
    for cid, g in df.groupby("company_id", sort=False):
        h = g["health"].to_numpy(dtype=float)
        hs = _ema(h, C.HEALTH_SMOOTHING)
        n = len(hs)
        d1 = np.full(n, np.nan); d3 = np.full(n, np.nan)
        d1[1:] = hs[1:] - hs[:-1]
        d3[3:] = hs[3:] - hs[:-3]
        traj = [_trajectory(d3[i], d1[max(0, i - 2):i + 1]) for i in range(n)]
        # bache puntual (sobre la salud SIN suavizar): caída de un mes recuperada (>= 60 %) al mes siguiente
        d1_raw = np.full(n, np.nan); d1_raw[1:] = h[1:] - h[:-1]
        blip = np.zeros(n, dtype=bool)
        for i in range(2, n):
            if d1_raw[i - 1] <= -C.BLIP_DROP and d1_raw[i] >= 0.6 * abs(d1_raw[i - 1]):
                blip[i] = True
        # caída estructural: "deteriorándose" 3 meses seguidos
        structural = np.zeros(n, dtype=bool)
        for i in range(2, n):
            structural[i] = all(t == "deteriorándose" for t in traj[i - 2:i + 1])
        # excepcionalmente sólida: >= EXCEPTIONAL_MONTHS meses seguidos con salud suavizada >= 90
        exceptional = np.zeros(n, dtype=bool)
        run = 0
        for i in range(n):
            run = run + 1 if (not np.isnan(hs[i]) and hs[i] >= C.EXCEPTIONAL_MIN_HEALTH) else 0
            exceptional[i] = run >= C.EXCEPTIONAL_MONTHS
        parts.append(pd.DataFrame({"health_smooth": hs, "health_delta_1m": d1, "health_delta_3m": d3, "trajectory": traj,
                                   "is_blip": blip, "is_structural": structural, "is_exceptional": exceptional}, index=g.index))
    df = df.join(pd.concat(parts))
    df["health_band"] = df["health_smooth"].map(health_band)
    # monitor proactivo: qué merece atención este mes
    df["alert"] = np.select(
        [df["is_structural"], df["health_delta_1m"] <= -C.ALERT_MIN_DROP_1M, df["trajectory"] == "deteriorándose",
         df["trajectory"] == "mejorando", df["is_exceptional"]],
        ["caída estructural", "caída brusca este mes", "deterioro incipiente", "mejora progresiva", "excepcionalmente sólida"],
        default="")
    return df


def explain_change(shap_now: pd.Series, shap_prev: pd.Series, values_now: pd.Series, values_prev: pd.Series,
                   describe, top_n: int = 5) -> list[dict]:
    """Qué señales explican el cambio de score entre T−1 y T: mayores |Δ SHAP|, con el valor antes/después."""
    delta = (shap_now - shap_prev).astype(float)
    order = delta.abs().sort_values(ascending=False).index[:top_n]
    out = []
    for f in order:
        out.append({"feature": f, "delta_shap": float(delta[f]), "direction": "empeora" if delta[f] > 0 else "mejora",
                    "before": describe(f, values_prev.get(f)), "after": describe(f, values_now.get(f))})
    return out
