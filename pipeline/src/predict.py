"""Predicción sobre empresas NUEVAS (test oculto del reto): CSVs → scores, sin reentrenar.

    python -m src.predict --raw <carpeta con los CSV del test> --out <carpeta de salida>

Salida (en --out):
    predictions.csv          una fila por empresa y mes: p_deterioro, salud, salud suavizada, banda, trayectoria, flags
    predictions_latest.csv   una fila por empresa (último mes): lo que se entrega
    explanations.csv         top-5 señales SHAP por empresa y mes (nivel)
    changes.csv              qué señales explican el cambio de score en el último mes
    summary.json             resumen: nº empresas, meses, distribución de bandas y trayectorias, versión del modelo

El modelo es el registrado en models/registry/latest.txt. Las features se calculan con exactamente el mismo código
que en entrenamiento (src/ingest.py → src/schema.py → src/features.py) sobre un directorio de trabajo aparte, de modo
que no se toca nada del proyecto. Bancos/ERPs no vistos en entrenamiento se codifican como "__other__".
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import time
from pathlib import Path

import duckdb
import pandas as pd

REQUIRED = ["companies", "banking_products", "transactions", "balances"]
OPTIONAL = {
    "groups": "group_id,erp,n_companies_in_sample\n",
    "debt_products": "product_id,company_id,label,type,bank_name,service,currency,created_at,granted,outstanding,liquidity\n",
    "debt_schedule_config": ("product_id,company_id,settlement_product_id,currency,amortization_type,interest_calc_method,"
                             "amortising_frequency,granted_balance,outstanding_balance,total_periods,next_payment_date,"
                             "last_payment_date,annual_interest_rate_or_spread,interest_type\n"),
    "invoices": ("operation_id,company_id,document_type,issuance_date,due_date,payment_date,amount,pending_amount,currency,"
                 "accounting_currency,exchange_rate,status,concept,counterparty_id\n"),
}


def stage_raw(raw: Path, work: Path) -> Path:
    """Si faltan ficheros opcionales, prepara una copia con placeholders vacíos (groups se deriva de companies)."""
    missing = [f for f in REQUIRED if not (raw / f"{f}.csv").exists()]
    if missing:
        raise SystemExit(f"faltan ficheros obligatorios en {raw}: {missing}")
    if all((raw / f"{f}.csv").exists() for f in OPTIONAL):
        return raw
    staged = work / "raw"
    staged.mkdir(parents=True, exist_ok=True)
    for f in REQUIRED + list(OPTIONAL):
        src = raw / f"{f}.csv"
        if src.exists():
            shutil.copy(src, staged / f"{f}.csv")
        elif f == "groups":
            comp = pd.read_csv(src.parent / "companies.csv", usecols=["group_id"])
            g = comp["group_id"].value_counts().rename("n_companies_in_sample").reset_index().rename(columns={"index": "group_id"})
            g["erp"] = None
            g[["group_id", "erp", "n_companies_in_sample"]].to_csv(staged / "groups.csv", index=False)
        else:
            (staged / f"{f}.csv").write_text(OPTIONAL[f], encoding="utf-8")
            print(f"[predict] aviso: no hay {f}.csv en el test; se usa vacío")
    return staged


def detect_dates(raw: Path) -> dict:
    """Rango temporal real del test: primer mes con movimientos, último mes completo y fecha de la foto."""
    con = duckdb.connect()
    lo, hi = con.execute(f"SELECT min(date), max(date) FROM read_csv('{(raw / 'transactions.csv').as_posix()}', all_varchar=true)").fetchone()
    lo, hi = pd.Timestamp(lo), pd.Timestamp(hi)
    snap = con.execute(f"SELECT max(date) FROM read_csv('{(raw / 'balances.csv').as_posix()}', all_varchar=true)").fetchone()[0]
    snap = pd.Timestamp(snap) if snap else hi
    data_end = snap.normalize() + pd.Timedelta(days=1) if snap.normalize() <= hi.normalize() else hi.normalize() + pd.Timedelta(days=1)
    last_full = (data_end - pd.Timedelta(days=1)).to_period("M")
    if (data_end - pd.Timedelta(days=1)).day < 28:      # el último mes está incompleto → se descarta
        last_full = last_full - 1
    return {"FIRST_MONTH": lo.strftime("%Y-%m"), "LAST_MONTH": last_full.strftime("%Y-%m"),
            "DATA_START": lo.strftime("%Y-%m-01"), "DATA_END": (last_full + 1).strftime("%Y-%m-01"),
            "SNAPSHOT_DATE": snap.strftime("%Y-%m-%d")}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--raw", required=True, help="carpeta con los CSV del test oculto")
    ap.add_argument("--out", required=True, help="carpeta de salida")
    ap.add_argument("--model", default=None, help="versión del registro (por defecto latest.txt)")
    ap.add_argument("--top-n", type=int, default=5)
    args = ap.parse_args(argv)
    t0 = time.time()
    raw, out = Path(args.raw).resolve(), Path(args.out).resolve()
    work = out / "work"
    work.mkdir(parents=True, exist_ok=True)
    raw = stage_raw(raw, work)
    dates = detect_dates(raw)
    # --- entorno ANTES de importar src.config: rutas de trabajo aparte y rango de fechas del test ---
    os.environ.update({"RAW_DIR": str(raw), "DATA_DIR": str(work / "data"), "REPORTS_DIR": str(work / "reports"), **dates})
    os.environ.setdefault("MODELS_DIR", str(Path(__file__).resolve().parents[1] / "models"))
    from src import config as C
    from src import evaluate, features, ingest, schema
    from src.health import add_health, explain_change
    print(f"[predict] test: {raw}  meses {C.FIRST_MONTH}…{C.LAST_MONTH}  foto {C.SNAPSHOT_DATE}")
    C.ensure_dirs()

    # --- mismas tres capas que en entrenamiento --------------------------------------------
    ingest.run()
    schema.build_company_month()
    X, meta = features.build_features(save=True)
    print(f"[predict] panel: {len(X):,} filas empresa-mes, {X['company_id'].nunique()} empresas")

    # --- scoring con el modelo registrado --------------------------------------------------
    art, md, version = evaluate.load_registry(args.model)
    art["block_of"] = {f: b for b, fs in md["feature_blocks"].items() for f in fs}
    missing = [f for f in art["features_B"] if f not in X.columns]
    if missing:
        raise SystemExit(f"faltan features respecto al modelo: {missing[:10]}")
    X = X.sort_values(["company_id", "t_idx"]).reset_index(drop=True)
    pred = X[["company_id", "T"]].copy()
    pred["p_deterioro"] = evaluate.score_main(art, X, calibrated=True)
    pred["p_modelo_A"] = art["pipelines"]["lgbm_A"].predict_proba(X[art["features_A"]])[:, 1]
    pred = add_health(pred, "p_deterioro")
    pred["model_version"] = version

    # --- explicaciones: nivel (top-n por fila) y cambio del último mes ------------------------
    expl = evaluate.local_explanations(art, X, top_n=args.top_n)
    S = evaluate.shap_values(art, X)
    last_T = X["T"].max()
    changes = []
    for cid, g in X.groupby("company_id"):
        g = g.sort_values("t_idx")
        if len(g) < 2 or g["T"].iloc[-1] != last_T:
            continue
        i_now, i_prev = g.index[-1], g.index[-2]
        own = [f for f in art["features_B"] if art["block_of"].get(f) != "E"]     # señales propias, no contexto de grupo/banco
        for r in explain_change(S.loc[i_now, own], S.loc[i_prev, own], X.loc[i_now], X.loc[i_prev], evaluate.describe, top_n=args.top_n):
            changes.append({"company_id": cid, "T": last_T, "T_prev": g["T"].iloc[-2], **r})
    changes = pd.DataFrame(changes)

    # --- salida ---------------------------------------------------------------------------------
    latest = pred[pred["T"] == last_T].copy()
    top_txt = (expl[expl["T"] == last_T].sort_values(["company_id", "rank"]).groupby("company_id")
               .apply(lambda d: " | ".join(f"{'↑' if s > 0 else '↓'} {t}" for t, s in zip(d["text"].head(3), d["shap"].head(3))), include_groups=False))
    latest["razones_principales"] = latest["company_id"].map(top_txt)
    cols = ["company_id", "T", "health", "health_smooth", "health_band", "trajectory", "health_delta_1m", "health_delta_3m",
            "is_blip", "is_structural", "is_exceptional", "alert", "p_deterioro", "p_modelo_A", "razones_principales", "model_version"]
    latest = latest[cols].sort_values("health_smooth")
    pred.to_csv(out / "predictions.csv", index=False, float_format="%.4f")
    latest.to_csv(out / "predictions_latest.csv", index=False, float_format="%.4f")
    expl.to_csv(out / "explanations.csv", index=False, float_format="%.4f")
    changes.to_csv(out / "changes.csv", index=False, float_format="%.4f")
    summary = {
        "model_version": version, "n_companies": int(pred["company_id"].nunique()), "months": [C.FIRST_MONTH, C.LAST_MONTH],
        "latest_month": last_T, "n_rows": int(len(pred)),
        "bands_latest": latest["health_band"].value_counts().to_dict(),
        "trajectory_latest": latest["trajectory"].value_counts().to_dict(),
        "n_exceptional": int(latest["is_exceptional"].sum()), "n_structural": int(latest["is_structural"].sum()),
        "n_blip": int(latest["is_blip"].sum()), "seconds": round(time.time() - t0, 1),
    }
    (out / "summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[predict] {summary['n_companies']} empresas → {out / 'predictions_latest.csv'}  ({summary['seconds']}s)")
    print(f"[predict] bandas: {summary['bands_latest']}  trayectorias: {summary['trajectory_latest']}")
    return summary


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
