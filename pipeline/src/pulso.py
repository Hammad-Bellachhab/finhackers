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
from src import projection as proj
from src.api import db
from src.api.inference import SCENARIOS, InferenceService
from src.evaluate import score_main
from src.features import CATEGORICAL
from src.metrics import metric_values, metrics, num, overrides_for
from src.providers import providers

STATE: dict = {}          # export() deja aquí el InferenceService y el pool de trayectorias
OUT = C.ROOT.parent / "frontend" / "public" / "data"
GRID = 11                 # puntos de la rejilla del simulador por métrica

BAND = {"sólida": "healthy", "sana": "healthy", "vigilar": "stable", "riesgo": "risk"}
TREND = {"mejorando": "up", "deteriorándose": "down"}
# Rasgos de perfil (banco, ERP, antigüedad…): el modelo los usa, pero no son algo que la empresa pueda mover
PROFILE = set(CATEGORICAL) | {"tenure_months", "months_in_panel", "group_size", "country_missing", "erp_missing", "has_invoices"}


def trend(t: str) -> str:
    return TREND.get(t, "flat")


def add_months(month: str, n: int) -> str:
    y, m = map(int, month.split("-"))
    k = y * 12 + m - 1 + n
    return f"{k // 12}-{k % 12 + 1:02d}"


# --------------------------------------------------------------------------------------
# Lecturas
# --------------------------------------------------------------------------------------
def history(cid: str) -> pd.DataFrame:
    h = db.q('SELECT "T", score, health, health_smooth, health_band, trajectory, health_delta_1m, health_delta_3m, is_blip, is_structural '
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


def pool() -> proj.Pool:
    """Todas las trayectorias de 6 meses del panel; se construye una vez por proceso (≈ 1 s)."""
    if "pool" not in STATE:
        df = db.q('SELECT company_id, "T", health, health_smooth FROM risk_score ORDER BY company_id, "T"')
        STATE["pool"] = proj.build_pool(df)
        STATE["coverage"] = proj.coverage()
    return STATE["pool"]


def forecast(cid: str):
    h = history(cid)
    # Montecarlo empírico: 2.000 trayectorias de empresas que estaban como esta (src/projection.py).
    f = proj.fan_for(pool(), h, cid)
    months = [add_months(h["T"].iloc[-1], k) for k in range(1, proj.HORIZON + 1)]
    pts = lambda key: [{"month": m, "score": round(float(v), 1)} for m, v in zip(months, f[key])]
    mid, lo, hi = pts("median"), pts("low"), pts("high")
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
            "stability": stab, "stabilityNote": note, "detection": detection(cid),
            "basis": {"paths": f["nPaths"], "neighbours": f["nNeighbours"], "companies": f["nCompanies"],
                      "interval": int(round(100 * (proj.HIGH_Q - proj.LOW_Q))), "coverage": STATE.get("coverage"),
                      "probDrop5": round(f["probDrop5"], 3), "probRisk": round(f["probRisk"], 3)}}


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
    r = db.q('SELECT r.company_id, r.health_smooth, r.health_band, r.trajectory, r.health_delta_3m, r.health_delta_1m, r.alert, r.score AS p, '
             'c.group_id, c.size_cohort, c.country, c.erp, c.main_bank '
             'FROM risk_score r JOIN company c USING(company_id) WHERE r."T" = :T', T=T)
    ex = actionable(db.q('SELECT company_id, rank, feature, text FROM score_explanation WHERE "T" = :T ORDER BY rank', T=T))
    r["top"] = r["company_id"].map(ex.groupby("company_id")["text"].first())
    held = held_out()
    rows = [{"companyId": x.company_id, "name": x.company_id, "score": round(float(x.health_smooth), 1),
             "band": BAND[x.health_band], "trend": trend(x.trajectory), "delta3m": round(num(x.health_delta_3m, 0), 1),
             "heldOut": x.company_id in held, "topDriver": x.top if isinstance(x.top, str) else "—",
             "healthBand": x.health_band, "trajectory": x.trajectory, "signal": x.alert or "", "delta1m": round(num(x.health_delta_1m, 0), 1),
             "pDeterioration": round(float(x.p), 4), "group": x.group_id, "sizeCohort": x.size_cohort, "country": x.country,
             "erp": x.erp, "bank": x.main_bank} for x in r.itertuples()]
    count = lambda k, v: sum(1 for x in rows if x[k] == v)
    return {"rows": rows, "counts": {"healthy": count("band", "healthy"), "stable": count("band", "stable"), "risk": count("band", "risk"),
                                     "improving": count("trend", "up"), "slipping": count("trend", "down"),
                                     "heldOut": count("heldOut", True)},
            "month": T, "history": history_by_month()}


def history_by_month() -> list[dict]:
    """Evolución de la cartera: empresas por banda de salud y salud media, mes a mes."""
    h = db.q('SELECT "T", health_band, count(*) AS n, avg(health_smooth) AS mean FROM risk_score GROUP BY "T", health_band')
    out = []
    for T, g in h.groupby("T"):
        n = dict(zip(g["health_band"], g["n"].astype(int)))
        out.append({"month": T, "solid": n.get("sólida", 0), "healthy": n.get("sana", 0), "watch": n.get("vigilar", 0),
                    "risk": n.get("riesgo", 0), "meanHealth": round(float((g["mean"] * g["n"]).sum() / g["n"].sum()), 1)})
    return out


def alerts():
    # Join con company para poder filtrar el monitor por empresa/cartera (grupo, tamaño, país)
    # igual que ya se filtra la vista Cartera (ver portfolio()).
    al = db.q('SELECT a.*, c.group_id, c.size_cohort, c.country FROM alerts a JOIN company c USING(company_id)')
    ev = pd.read_csv(C.REPORTS_DIR / "anticipation_events.csv").dropna(subset=["alert_month"]).groupby("company_id")["lead_months"].last()
    out = []
    for a in al.itertuples():
        kind = "improving" if a.alert in ("mejora progresiva", "excepcionalmente sólida") else "slipping"
        lead = ev.get(a.company_id)
        out.append({"id": f"{a.company_id}-{a.T}", "companyId": a.company_id, "companyName": a.company_id, "kind": kind,
                    "score": round(float(a.health_smooth), 1), "delta": round(num(a.health_delta_3m, 0), 1),
                    "monthsAhead": None if lead is None or pd.isna(lead) else int(lead),
                    "message": f"{a.alert.capitalize()}: {a.why}" if a.why else a.alert.capitalize(),
                    "createdAt": f"{a.T}-01T08:00:00Z", "signal": a.alert, "severity": int(a.severity),
                    "delta1m": round(num(a.health_delta_1m, 0), 1), "why": a.why or "",
                    "group": a.group_id, "sizeCohort": a.size_cohort, "country": a.country})
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


def profile(cid: str) -> dict:
    """Ficha de empresa del dashboard de Diego: perfil, SHAP, cambios, trayectoria, tesorería, benchmark y escenarios."""
    c = db.company(cid)
    ss = pd.DataFrame(c.pop("score_series"))
    k = pd.DataFrame(c.pop("kpi_series"))
    T = ss["T"].iloc[-1]
    last = ss.iloc[-1]
    scoreA = db.q('SELECT "T", score_A FROM risk_score WHERE company_id = :cid ORDER BY "T"', cid=cid).set_index("T")["score_A"]
    shap = db.q('SELECT feature, block, shap, text FROM score_explanation WHERE company_id = :cid AND "T" = :T ORDER BY rank', cid=cid, T=T)
    rnd = lambda v, d=2: None if v is None or pd.isna(v) else round(float(v), d)
    base = db.company_features(cid)
    svc = STATE["svc"]
    scen = []
    for sid, sc in SCENARIOS.items():
        r = svc.simulate(base, None, sid)
        scen.append({"id": sid, "label": sc["label"], "before": rnd(100 * (1 - r["before"]["score"]), 1),
                     "after": rnd(100 * (1 - r["after"]["score"]), 1), "changes": r["applied_changes"],
                     "explanation": [{"text": e["text"], "shap": rnd(e["shap"], 3), "block": e["block"]} for e in r["explanation_after"]]})
    return {
        "companyId": cid, "name": cid,
        "facts": {"group": c["group_id"], "groupSize": int(c["group_size"] or 1), "country": c["country"], "erp": c["erp"],
                  "bank": c["main_bank"], "accounts": int(c["n_bank_accounts"] or 0), "debtProducts": int(c["n_debt_products"] or 0),
                  "months": int(c["months_in_panel"] or 0), "sizeCohort": c["size_cohort"]},
        "now": {"month": T, "health": rnd(last["health_smooth"], 1), "healthBand": last["health_band"], "trajectory": last["trajectory"],
                "signal": last["alert"] or ("bache puntual, recuperado" if last["is_blip"] else ""),
                "p": rnd(last["score"], 4), "pDelta1m": rnd(last["delta_1m"], 4), "pModelA": rnd(scoreA.get(T), 4)},
        "history": [{"month": r.T, "health": rnd(r.health, 1), "smooth": rnd(r.health_smooth, 1),
                     "modelA": rnd(100 * (1 - scoreA.get(r.T)), 1) if scoreA.get(r.T) is not None else None,
                     "deteriorated": r.realized_label == 1} for r in ss.itertuples()],
        "treasury": [{"month": r.T, "cash": rnd(r.cash_balance, 0), "inflow": rnd(r.inflow_oper, 0), "outflow": rnd(r.outflow_oper, 0),
                      "payDelay": rnd(r.pay_dpd_mean_w3, 1), "collectDelay": rnd(r.rec_dpd_mean_w3, 1),
                      "overdueShare": rnd(r.pay_open_overdue_share_w3, 3), "interestCharges": rnd(r.interest_n_w3, 0)} for r in k.itertuples()],
        "shap": [{"text": r.text, "shap": rnd(r.shap, 3), "block": r.block} for r in shap.itertuples()],
        "changes": [{"after": r["after"], "before": r["before"], "direction": r["direction"]} for r in db.company_changes(cid, T)[:5]],
        "benchmark": db.benchmarks(cid, T, None, None, None),
        "scenarios": scen,
    }


def model_report() -> dict:
    """Rendimiento del modelo (vista de Diego): evaluación completa + datos del modelo servido."""
    ev = json.loads((C.REPORTS_DIR / "evaluation_summary.json").read_bytes().decode("utf-8", errors="replace"))
    info = STATE["svc"].info()
    return {**ev, "n_features": info["n_features"], "feature_blocks": info["feature_blocks"], "label": info["label"],
            "cv": ev["cv"], "figures": sorted(p.name for p in (C.REPORTS_DIR / "figures").glob("*.png"))}


def write(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":"), default=float), encoding="utf-8")


def export() -> None:
    STATE["svc"] = InferenceService()
    # No se borra OUT: los análisis de TellMe (tellme.json) viven aquí y no los escribe este script.
    # Los ficheros se sobreescriben uno a uno; el conjunto de empresas no cambia.
    pf = portfolio()
    write(OUT / "portfolio.json", pf)
    write(OUT / "providers.json", providers(pf["rows"], pf["month"]))
    write(OUT / "alerts.json", alerts())
    write(OUT / "evidence.json", evidence())
    write(OUT / "model.json", model_report())
    shutil.copytree(C.REPORTS_DIR / "figures", OUT / "figures", dirs_exist_ok=True)
    ids = db.q('SELECT DISTINCT company_id FROM risk_score ORDER BY company_id')["company_id"]
    metricas: dict[str, dict] = {}
    for i, cid in enumerate(ids):
        d = OUT / "companies" / cid
        cs = company_score(cid)
        metricas[cid] = {m["id"]: m["value"] for m in cs["metrics"]}
        write(d / "score.json", cs)
        write(d / "forecast.json", forecast(cid))
        write(d / "decisions.json", decisions(cid))
        write(d / "simulate.json", sim_grid(cid))
        write(d / "profile.json", profile(cid))
        if i % 100 == 0:
            print(f"[pulso] {i}/{len(ids)}", flush=True)
    # Las métricas de cada empresa también en la tabla de cartera: así TellMe puede buscar
    # ("cuáles dependen de un solo cliente y van justas de caja") sin abrir 1.286 ficheros.
    for row in pf["rows"]:
        row["metrics"] = metricas.get(row["companyId"], {})
    write(OUT / "portfolio.json", pf)
    print(f"[pulso] {len(ids)} empresas en {OUT}")


def refresh_forecasts() -> None:
    """Reescribe solo forecast.json de cada empresa, sin tocar el resto de frontend/public/data/.

    `export()` empieza con un rmtree, que se llevaría por delante los tellme.json de Gemini; y
    cambiar la proyección no cambia nada más del contrato. No hace falta cargar el modelo.
    """
    ids = db.q('SELECT DISTINCT company_id FROM risk_score ORDER BY company_id')["company_id"]
    for i, cid in enumerate(ids):
        write(OUT / "companies" / cid / "forecast.json", forecast(cid))
        if i % 200 == 0:
            print(f"[pulso] forecast {i}/{len(ids)}", flush=True)
    print(f"[pulso] {len(ids)} forecast.json regenerados en {OUT}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    refresh_forecasts() if sys.argv[1:2] == ["forecast"] else export()
