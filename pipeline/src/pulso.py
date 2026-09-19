"""Exporta el contrato de Pulso (docs/superpowers/specs/2026-09-19-pulso-design.md §8) a JSON estático.

El front se sirve entero desde Cloudflare sin servidor: cada respuesta se precalcula aquí, a partir de la
BD servida y del modelo, en frontend/public/data/. El simulador se precalcula como una rejilla de valores
por métrica que el front interpola. La salud es 100·(1−p) suavizada (src/health.py).

Uso (después de python -m src.pipeline all):  python -m src.pulso
"""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from src import config as C
from src.api import db
from src.evaluate import score_main
from src.features import CATEGORICAL

STATE: dict = {}          # export() deja aquí el InferenceService
OUT = C.ROOT.parent / "frontend" / "public" / "data"
GRID = 11                 # puntos de la rejilla del simulador por métrica

BAND = {"sólida": "healthy", "sana": "healthy", "vigilar": "stable", "riesgo": "risk"}
TREND = {"mejorando": "up", "deteriorándose": "down"}
HORIZON = 6
# Rasgos de perfil (banco, ERP, antigüedad…): el modelo los usa, pero no son algo que la empresa pueda mover
PROFILE = set(CATEGORICAL) | {"tenure_months", "months_in_panel", "group_size", "country_missing", "erp_missing", "has_invoices"}


def trend(t: str) -> str:
    return TREND.get(t, "flat")


def add_months(month: str, n: int) -> str:
    y, m = map(int, month.split("-"))
    k = y * 12 + m - 1 + n
    return f"{k // 12}-{k % 12 + 1:02d}"


def num(v, default=np.nan) -> float:
    return default if v is None or pd.isna(v) else float(v)


# --------------------------------------------------------------------------------------
# Métricas: cada una sale de features del modelo, así el simulador mueve el modelo real.
# --------------------------------------------------------------------------------------
def metric_values(f: dict) -> dict[str, float]:
    dso = num(f.get("cash_conversion_days_w6"))
    dpo = num(f.get("pay_term_days_w6")) + num(f.get("pay_dpd_mean_w6"), 0)
    dsr = num(f.get("debt_service_ratio_w6"), 0)
    return {"dso": dso, "dpo": dpo, "ccc": dso - dpo,
            "dscr": 1 / dsr if dsr > 0 else np.nan,              # sin deuda que servir no hay DSCR
            "cash_days": num(f.get("days_of_cash")), "credit_usage": num(f.get("credit_util_T")),
            "concentration": num(f.get("top1_in_share"))}


def overrides_for(metric_id: str, f: dict, value: float) -> dict[str, float]:
    """Qué features cambian si la métrica pasa a `value`."""
    d = value - metric_values(f)[metric_id]
    shift = lambda *ks: {k: num(f.get(k), 0) + d for k in ks}
    if metric_id in ("dso", "ccc"):
        return shift("cash_conversion_days_w6", "rec_dpd_mean_w3", "rec_dpd_mean_w6")
    if metric_id == "dpo":
        return shift("pay_dpd_mean_w3", "pay_dpd_mean_w6")
    if metric_id == "dscr":
        return {"debt_service_ratio_w6": 1 / max(value, 0.05)}
    if metric_id == "cash_days":
        return {"days_of_cash": value, "cash_months_of_outflow": value / 30}
    if metric_id == "credit_usage":
        return {"credit_util_T": value, "credit_util_max_w6": max(value, num(f.get("credit_util_max_w6"), 0))}
    if metric_id == "concentration":
        return {"top1_in_share": value}
    raise ValueError(f"métrica desconocida: {metric_id}")


METRIC_META = {   # label, unit, dirección buena (+1 = más es mejor), umbral fijo (None = mediana propia 12 m)
    "dso": ("Días en cobrar", "days", -1, None),
    "dpo": ("Días en pagar", "days", 0, None),              # 0: alejarse de su mediana en cualquier sentido es malo
    "ccc": ("Ciclo de caja", "days", -1, None),
    "dscr": ("Cobertura del servicio de deuda", "ratio", +1, 1.25),
    "cash_days": ("Días de caja", "days", +1, 60.0),
    "credit_usage": ("Uso de líneas", "pct", -1, 0.8),
    "concentration": ("Concentración de clientes", "pct", -1, 0.3),
}


def metrics(feats: pd.DataFrame) -> list[dict]:
    """feats: company_features de la empresa, ordenadas por mes (la última es la actual)."""
    hist = pd.DataFrame([metric_values(r) for r in feats.to_dict("records")])
    out = []
    for mid, (label, unit, good, fixed) in METRIC_META.items():
        v = hist[mid].iloc[-1]
        if pd.isna(v):
            continue
        ref = fixed if fixed is not None else float(hist[mid].tail(12).median())
        gap = (v - ref) * good if good else -abs(v - ref)   # < 0 = peor que la referencia
        tol = {"days": 10, "ratio": 0.1, "pct": 0.1}[unit]
        status = "ok" if gap >= 0 else ("watch" if gap > -tol else "breach")
        out.append({"id": mid, "label": label, "value": round(float(v), 3), "unit": unit, "reference": round(ref, 3), "status": status})
    return out


# --------------------------------------------------------------------------------------
# Lecturas
# --------------------------------------------------------------------------------------
def history(cid: str) -> pd.DataFrame:
    h = db.q('SELECT "T", score, health_smooth, health_band, trajectory, health_delta_1m, health_delta_3m, is_blip, is_structural '
             'FROM risk_score WHERE company_id = :cid ORDER BY "T"', cid=cid)
    if h.empty:
        raise ValueError(f"empresa sin score: {cid}")
    return h


def features(cid: str) -> pd.DataFrame:
    return db.q('SELECT * FROM company_features WHERE company_id = :cid ORDER BY "T"', cid=cid)


def held_out() -> set[str]:
    return set(C.test_company_ids())


def health_many(rows: list[dict]) -> np.ndarray:
    svc = STATE["svc"]
    X = pd.concat([svc.frame(r) for r in rows], ignore_index=True)
    return 100 * (1 - score_main(svc.art, X, calibrated=True))


def health_of(overrides: dict, base: dict) -> float:
    return float(health_many([{**base, **overrides}])[0])


def actionable(ex: pd.DataFrame) -> pd.DataFrame:
    return ex[~ex["feature"].isin(PROFILE) & ~ex["text"].str.contains("nan", na=True)]


def drivers(cid: str, T: str, p: float) -> list[dict]:
    ex = actionable(db.q('SELECT "T", rank, feature, shap, direction, text FROM score_explanation WHERE company_id = :cid ORDER BY "T", rank', cid=cid))
    now = ex[ex["T"] == T].head(5)
    months = sorted(ex["T"].unique())
    out = []
    for r in now.itertuples():
        # 'since': mes más antiguo de la racha ininterrumpida en que esta señal empuja en el mismo sentido
        since = T
        for m in reversed(months[:months.index(T)]):
            hit = ex[(ex["T"] == m) & (ex["feature"] == r.feature) & (ex["direction"] == r.direction)]
            if hit.empty:
                break
            since = m
        # ponytail: SHAP en log-odds → puntos de salud con la derivada de la sigmoide en p; exacto solo para cambios pequeños
        impact = -100 * p * (1 - p) * r.shap
        out.append({"id": r.feature, "label": r.text, "direction": "up" if impact > 0 else "down",
                    "impact": round(impact, 1), "since": since,
                    "detail": f"{'Resta' if impact < 0 else 'Suma'} {abs(impact):.1f} puntos de salud este mes."})
    return out


def detection(cid: str) -> dict | None:
    ev = pd.concat([pd.read_csv(C.REPORTS_DIR / "anticipation_events.csv"),
                    pd.read_csv(C.REPORTS_DIR / "test_companies" / "anticipation_events.csv")])
    ev = ev[(ev["company_id"] == cid) & ev["alert_month"].notna()].sort_values("event_month")
    if ev.empty:
        return None
    r = ev.iloc[-1]
    return {"detectedAt": r["alert_month"], "evidentAt": r["event_month"], "monthsAhead": int(r["lead_months"])}


# --------------------------------------------------------------------------------------
# Pulso Empresa
# --------------------------------------------------------------------------------------
def company_score(cid: str):
    h = history(cid)
    last = h.iloc[-1]
    feats = features(cid)
    return {"companyId": cid, "name": cid, "score": round(float(last["health_smooth"]), 1),
            "band": BAND[last["health_band"]], "trend": trend(last["trajectory"]),
            "delta1m": round(num(last["health_delta_1m"], 0), 1), "delta3m": round(num(last["health_delta_3m"], 0), 1),
            "series": [{"month": r.T, "score": round(float(r.health_smooth), 1)} for r in h.tail(24).itertuples()],
            "drivers": drivers(cid, last["T"], float(last["score"])),
            "metrics": metrics(feats) if not feats.empty else [], "heldOut": cid in held_out()}


def projection(h: pd.DataFrame) -> tuple[list, list, list]:
    """Recta OLS sobre los últimos 6 meses de salud suavizada; banda = ±1,96·σ del residuo·√h."""
    y = h["health_smooth"].tail(6).to_numpy(float)
    x = np.arange(len(y))
    slope, icpt = np.polyfit(x, y, 1) if len(y) > 1 else (0.0, y[-1])
    sigma = max(float(np.std(y - (slope * x + icpt))), 2.0)
    T = h["T"].iloc[-1]
    mid, lo, hi = [], [], []
    for k in range(1, HORIZON + 1):
        m, v = add_months(T, k), float(np.clip(y[-1] + slope * k, 0, 100))
        w = 1.96 * sigma * np.sqrt(k)
        mid.append({"month": m, "score": round(v, 1)})
        lo.append({"month": m, "score": round(max(0, v - w), 1)})
        hi.append({"month": m, "score": round(min(100, v + w), 1)})
    return mid, lo, hi


def forecast(cid: str):
    h = history(cid)
    mid, lo, hi = projection(h)
    last = h.iloc[-1]
    if bool(last["is_structural"]):
        stab, note = "structural", "Caída sostenida tres meses seguidos: es deterioro, conviene actuar."
    elif bool(h["is_blip"].tail(3).any()):
        stab, note = "dip", "Bache de un mes que ya se ha recuperado: no actúes."
    elif last["trajectory"] == "deteriorándose":
        stab, note = "dip", "Empieza a torcerse, pero aún no es estructural: vigila el próximo mes."
    else:
        stab, note = "dip", "Sin caída sostenida: el movimiento está dentro de lo normal."
    return {"companyId": cid, "horizon": mid, "bandLow": lo, "bandHigh": hi,
            "stability": stab, "stabilityNote": note, "detection": detection(cid)}


def daily(f: dict, key: str) -> float:
    return np.expm1(num(f.get(key), 0)) / 30


def decisions(cid: str):
    feats = features(cid)
    if feats.empty:
        return []
    base = feats.iloc[-1].to_dict()
    ms = {m["id"]: m for m in metrics(feats)}
    now = health_of({}, base)
    inflow_d, outflow_d = daily(base, "inflow_w1_log"), daily(base, "outflow_w1_log")
    out = []

    def push(lever, title, rationale, mid, target, cash, caution=None):
        cur = ms[mid]["value"]
        out.append({"id": f"{cid}-{lever}", "lever": lever, "title": title, "rationale": rationale, "metricId": mid,
                    "currentValue": cur, "targetValue": round(target, 3), "cashImpact": round(max(cash, 0)),
                    "scoreImpact": round(health_of(overrides_for(mid, base, target), base) - now, 1), "caution": caution})

    if "dso" in ms and ms["dso"]["value"] > ms["dso"]["reference"] + 10:
        m = ms["dso"]
        push("collect_faster", "Acelera el cobro", f"Cobras en {m['value']:.0f} días, {m['value'] - m['reference']:.0f} más que tu mediana de 12 meses.",
             "dso", m["reference"], (m["value"] - m["reference"]) * inflow_d)
    if "dpo" in ms and "cash_days" in ms and ms["dpo"]["value"] < ms["dpo"]["reference"] - 10 and ms["cash_days"]["value"] < 60:
        m = ms["dpo"]
        push("pay_slower", "Negocia más plazo con proveedores", f"Pagas en {m['value']:.0f} días, por debajo de tu histórico, con la caja tensa.",
             "dpo", m["reference"], (m["reference"] - m["value"]) * outflow_d,
             "Forzar el plazo de pago daña la relación con proveedores y puede acabar en peores precios.")
    bad = num(base.get("pay_bad_share_w6"), 0)
    if "dpo" in ms and bad > 0.3:
        m, term = ms["dpo"], num(base.get("pay_term_days_w6"), 0) or 30.0   # sin plazo pactado: 30 días
        push("pay_on_time", "Paga a tiempo a tus proveedores", f"El {bad:.0%} de tus facturas a pagar va con más de 30 días de retraso; se nota antes que en la caja.",
             "dpo", term, 0)
    if "dscr" in ms and ms["dscr"]["value"] < 1.25:
        m = ms["dscr"]
        push("refinance", "Refinancia la deuda", f"Tus entradas cubren la cuota {m['value']:.2f} veces; la banca pide al menos 1,25.",
             "dscr", 1.25, (1 / m["value"] - 1 / 1.25) * inflow_d * 30)
    if "cash_days" in ms and ms["cash_days"]["value"] < 60:
        m = ms["cash_days"]
        push("open_credit_line", "Abre o amplía una línea de crédito", f"Tienes caja para {max(m['value'], 0):.0f} días de gasto; por debajo de 60 hay tensión.",
             "cash_days", 90, (90 - m["value"]) * outflow_d)
    if "credit_usage" in ms and ms["credit_usage"]["value"] > 0.8:
        m = ms["credit_usage"]
        push("reduce_usage", "Reduce el uso de tus líneas", f"Tienes dispuesto el {m['value']:.0%} de lo concedido; por encima del 80 % es señal de estrés.",
             "credit_usage", 0.7, 0)
    if "concentration" in ms and ms["concentration"]["value"] > 0.3:
        m = ms["concentration"]
        push("diversify", "Diversifica clientes", f"Tu mayor cliente es el {m['value']:.0%} de tus cobros; por encima del 30 % eres frágil.",
             "concentration", 0.3, 0)
    return sorted(out, key=lambda d: (-d["cashImpact"], -d["scoreImpact"]))


def sim_grid(cid: str) -> dict:
    """Por métrica: valores de la barra del simulador (mismo rango que DecisionsSection.tsx) y su efecto."""
    feats = features(cid)
    if feats.empty:
        return {}
    base = feats.iloc[-1].to_dict()
    cur = metric_values(base)
    grids = {}
    for m in metrics(feats):
        lo = max(0, round(m["reference"] * 0.5))
        hi = round(max(m["value"], m["reference"]) * 1.5)
        grids[m["id"]] = np.linspace(lo, max(hi, lo + 1e-6), GRID)
    rows = [base] + [{**base, **overrides_for(mid, base, v)} for mid, vs in grids.items() for v in vs]
    h = health_many(rows)
    now, h = h[0], iter(h[1:])
    inflow_d, outflow_d = daily(base, "inflow_w1_log"), daily(base, "outflow_w1_log")
    out = {}
    for mid, vs in grids.items():
        cash = {"dso": lambda v: (cur["dso"] - v) * inflow_d, "dpo": lambda v: (v - cur["dpo"]) * outflow_d}.get(mid, lambda v: 0.0)
        out[mid] = [{"value": round(float(v), 4), "scoreDelta": round(float(next(h) - now), 1), "cashDelta": round(cash(v))} for v in vs]
    return out


# --------------------------------------------------------------------------------------
# Pulso Cartera
# --------------------------------------------------------------------------------------
def portfolio():
    T = db.latest_month()
    r = db.q('SELECT company_id, health_smooth, health_band, trajectory, health_delta_3m FROM risk_score WHERE "T" = :T', T=T)
    ex = actionable(db.q('SELECT company_id, rank, feature, text FROM score_explanation WHERE "T" = :T ORDER BY rank', T=T))
    r["top"] = r["company_id"].map(ex.groupby("company_id")["text"].first())
    held = held_out()
    rows = [{"companyId": x.company_id, "name": x.company_id, "score": round(float(x.health_smooth), 1),
             "band": BAND[x.health_band], "trend": trend(x.trajectory), "delta3m": round(num(x.health_delta_3m, 0), 1),
             "heldOut": x.company_id in held, "topDriver": x.top if isinstance(x.top, str) else "—"} for x in r.itertuples()]
    count = lambda k, v: sum(1 for x in rows if x[k] == v)
    return {"rows": rows, "counts": {"healthy": count("band", "healthy"), "stable": count("band", "stable"), "risk": count("band", "risk"),
                                     "improving": count("trend", "up"), "slipping": count("trend", "down"),
                                     "heldOut": count("heldOut", True)}}


def alerts():
    al = db.q("SELECT * FROM alerts")
    ev = pd.read_csv(C.REPORTS_DIR / "anticipation_events.csv").dropna(subset=["alert_month"]).groupby("company_id")["lead_months"].last()
    out = []
    for a in al.itertuples():
        if a.alert == "excepcionalmente sólida":
            continue
        kind = "improving" if a.alert == "mejora progresiva" else "slipping"
        lead = ev.get(a.company_id)
        out.append({"id": f"{a.company_id}-{a.T}", "companyId": a.company_id, "companyName": a.company_id, "kind": kind,
                    "score": round(float(a.health_smooth), 1), "delta": round(num(a.health_delta_3m, 0), 1),
                    "monthsAhead": None if lead is None or pd.isna(lead) else int(lead),
                    "message": f"{a.alert.capitalize()}: {a.why}" if a.why else a.alert.capitalize(),
                    "createdAt": f"{a.T}-01T08:00:00Z"})
    return out


def evidence():
    test = json.loads((C.REPORTS_DIR / "test_companies_eval.json").read_bytes().decode("utf-8", errors="replace"))
    ant = json.loads((C.REPORTS_DIR / "anticipation.json").read_bytes().decode("utf-8", errors="replace"))
    leads = pd.read_csv(C.REPORTS_DIR / "anticipation_events.csv")["lead_months"].dropna()
    r = db.q("SELECT company_id, health, trajectory, realized_D, realized_label FROM risk_score WHERE realized_D IS NOT NULL")
    # Spearman salud ↔ deterioro realizado, solo en las empresas que el modelo no vio
    t = r[r["company_id"].isin(held_out())]
    rho = float(-t["health"].rank().corr(t["realized_D"].rank())) if len(t) > 2 else 0.0
    # Cara buena: de las que marcamos 'mejorando', cuántas no se deterioraron después (acierto, no recall en sentido estricto)
    up = r[r["trajectory"] == "mejorando"]
    improving_ok = float((up["realized_label"] == 0).mean()) if len(up) else 0.0
    T = db.latest_month()
    s = db.q('SELECT sum(is_blip) AS blips, sum(is_structural) AS structural FROM risk_score WHERE "T" = :T', T=T).iloc[0]
    return {"holdout": {"companies": test["n_test_companies"], "auc": round(test["model_B"]["auc_roc"], 3), "spearman": round(rho, 3)},
            "anticipation": {"medianMonths": ant["lead_months_median"], "p25": float(leads.quantile(0.25)),
                             "p75": float(leads.quantile(0.75)), "detected": ant["n_anticipated"]},
            "bothDirections": {"improvingRecall": round(improving_ok, 3), "slippingRecall": round(ant["share_anticipated"], 3)},
            "stability": {"dipsCorrectlyIgnored": int(s["blips"] or 0), "structuralCaught": int(s["structural"] or 0)}}


def write(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":"), default=float), encoding="utf-8")


def export() -> None:
    from src.api.inference import InferenceService
    STATE["svc"] = InferenceService()
    shutil.rmtree(OUT, ignore_errors=True)
    write(OUT / "portfolio.json", portfolio())
    write(OUT / "alerts.json", alerts())
    write(OUT / "evidence.json", evidence())
    ids = db.q('SELECT DISTINCT company_id FROM risk_score ORDER BY company_id')["company_id"]
    for i, cid in enumerate(ids):
        d = OUT / "companies" / cid
        write(d / "score.json", company_score(cid))
        write(d / "forecast.json", forecast(cid))
        write(d / "decisions.json", decisions(cid))
        write(d / "simulate.json", sim_grid(cid))
        if i % 100 == 0:
            print(f"[pulso] {i}/{len(ids)}", flush=True)
    print(f"[pulso] {len(ids)} empresas en {OUT}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    export()
