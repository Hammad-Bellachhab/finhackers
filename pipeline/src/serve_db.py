"""Capa 8 — Base de datos servida. El flujo online no recalcula nada: lee de aquí.

Tablas:
    company             maestro de empresas con atributos de dimensión
    company_month_kpi   KPIs mensuales para las series del dashboard
    company_features    vector de features por empresa y mes (entrada del simulador / scoring online)
    risk_score          score calibrado, percentil, banda, delta mensual, versión de modelo
    score_explanation   top-n contribuciones SHAP por empresa y mes (precalculadas)
    benchmark           p25/p50/p75 por cohorte (tamaño × país × tamaño de grupo), solo si n >= 10
    model_info          versión, métricas, fecha de entrenamiento

Motor: SQLAlchemy con DATABASE_URL (sqlite:///data/serve.db por defecto; postgresql://… en Docker).
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text

from src import config as C
from src.evaluate import load_registry, score_main
from src.features import load_features
from src.labels import LABELS_PATH

KPI_COLS = [
    "cash_balance_T_log", "cash_months_of_outflow", "days_of_cash", "cash_neg_months_w3", "io_ratio_w1", "io_ratio_w3",
    "inflow_w1_log", "outflow_w1_log", "pay_dpd_mean_w3", "pay_open_overdue_share_w3", "pay_bad_share_w6",
    "rec_open_overdue_share_w3", "rec_dpd_mean_w3", "interest_n_w3", "credit_util_T", "hhi_in", "top1_in_share",
    "stress_terms_rate_w3", "no_counterparty_share_w3", "n_tx_w1", "salary_months_share_w6", "tax_months_share_w6",
]
BENCH_KPIS = ["score", "pay_dpd_mean_w3", "pay_open_overdue_share_w3", "io_ratio_w3", "cash_months_of_outflow", "hhi_in", "interest_n_w3"]


def band(p: float) -> str:
    for lo, hi, name in C.RISK_BANDS:
        if lo <= p < hi:
            return name
    return C.RISK_BANDS[-1][2]


def engine():
    return create_engine(C.DATABASE_URL, future=True)


def build_tables() -> dict[str, pd.DataFrame]:
    art, md, version = load_registry()
    X, meta = load_features()
    lab = pd.read_parquet(LABELS_PATH)
    last_labeled_T = lab["T"].max()

    # ---------------------------------------------------------------- risk_score
    X = X.sort_values(["company_id", "t_idx"]).reset_index(drop=True)
    X["score"] = score_main(art, X, calibrated=True)
    X["score_raw"] = score_main(art, X, calibrated=False)
    X["score_A"] = art["pipelines"]["lgbm_A"].predict_proba(X[art["features_A"]])[:, 1]
    X["percentile"] = X.groupby("T")["score"].rank(pct=True)
    X["percentile_cohort"] = X.groupby(["T", "size_cohort"])["score"].rank(pct=True)
    X["band"] = X["score"].map(band)
    X["score_prev"] = X.groupby("company_id")["score"].shift(1)
    X["delta_1m"] = X["score"] - X["score_prev"]
    X["is_out_of_sample"] = X["T"] > last_labeled_T
    risk = X[["company_id", "T", "score", "score_raw", "score_A", "percentile", "percentile_cohort", "band", "delta_1m", "is_out_of_sample"]].copy()
    risk["model_version"] = version
    risk["scored_at"] = datetime.now(timezone.utc).isoformat()
    # resultado realizado (solo meses etiquetados): para la vista "qué pasó después"
    risk = risk.merge(lab[["company_id", "T", "y", "D"]].rename(columns={"y": "realized_label", "D": "realized_D"}), on=["company_id", "T"], how="left")

    # ---------------------------------------------------------------- company
    last = X.groupby("company_id").tail(1).set_index("company_id")
    dim = pd.read_parquet(C.PARQUET_DIR / "company_month" / "dim_company.parquet").set_index("company_id")
    company = pd.DataFrame({
        "company_id": last.index, "group_id": dim.loc[last.index, "group_id"].values,
        "country": last["country"].values, "currency": last["currency"].values, "erp": last["erp_any"].values,
        "main_bank": last["main_bank"].values, "group_size": last["group_size"].values,
        "n_bank_accounts": last["n_bank_accounts"].values, "n_banks": last["n_banks"].values,
        "n_debt_products": last["n_debt_products"].values, "debt_granted_total_log": last["debt_granted_total"].values,
        "size_cohort": last["size_cohort"].values, "has_invoices": last["has_invoices"].values.astype(bool),
        "first_month": X.groupby("company_id")["T"].min().loc[last.index].values,
        "last_month": last["T"].values, "months_in_panel": last["months_in_panel"].values,
        "created_at": dim.loc[last.index, "created_at"].astype(str).values,
        "latest_score": last["score"].values, "latest_band": last["band"].values, "latest_delta_1m": last["delta_1m"].values,
        "latest_percentile": last["percentile"].values,
    }).reset_index(drop=True)

    # ---------------------------------------------------------------- company_month_kpi
    kpi = X[["company_id", "T"] + KPI_COLS].copy()
    kpi["cash_balance"] = np.sign(kpi["cash_balance_T_log"]) * np.expm1(np.abs(kpi["cash_balance_T_log"]))
    kpi["inflow_oper"] = np.expm1(kpi["inflow_w1_log"])
    kpi["outflow_oper"] = np.expm1(kpi["outflow_w1_log"])
    kpi = kpi.drop(columns=["cash_balance_T_log", "inflow_w1_log", "outflow_w1_log"])
    kpi = kpi.merge(lab[["company_id", "T"] + list(C.LABEL_WEIGHTS)].rename(columns={c: f"outcome_{c}" for c in C.LABEL_WEIGHTS}),
                    on=["company_id", "T"], how="left")

    # ---------------------------------------------------------------- score_explanation
    expl = pd.read_parquet(C.REPORTS_DIR / "score_explanations.parquet")
    expl["model_version"] = version

    # ---------------------------------------------------------------- benchmark
    B = X[["company_id", "T", "size_cohort", "country", "group_size", "score"] + [k for k in BENCH_KPIS if k != "score"]].copy()
    B["country_group"] = np.where(B["country"].isin(["ES", "UNK"]), B["country"], "OTHER")
    B["group_bucket"] = pd.cut(B["group_size"].fillna(1), [0, 1, 5, 100], labels=["1", "2-5", "6+"]).astype(str)
    rows = []
    for keys, g in B.groupby(["T", "size_cohort", "country_group", "group_bucket"]):
        if len(g) < C.MIN_COHORT_SIZE:
            continue
        for k in BENCH_KPIS:
            s = g[k].dropna()
            if len(s) < C.MIN_COHORT_SIZE:
                continue
            rows.append({"T": keys[0], "size_cohort": keys[1], "country_group": keys[2], "group_bucket": keys[3], "kpi": k,
                         "n": int(len(s)), "p25": float(s.quantile(0.25)), "p50": float(s.quantile(0.5)), "p75": float(s.quantile(0.75))})
    # cohorte "global por tamaño" como respaldo cuando la celda fina queda vacía
    for keys, g in B.groupby(["T", "size_cohort"]):
        for k in BENCH_KPIS:
            s = g[k].dropna()
            if len(s) >= C.MIN_COHORT_SIZE:
                rows.append({"T": keys[0], "size_cohort": keys[1], "country_group": "ALL", "group_bucket": "ALL", "kpi": k,
                             "n": int(len(s)), "p25": float(s.quantile(0.25)), "p50": float(s.quantile(0.5)), "p75": float(s.quantile(0.75))})
    bench = pd.DataFrame(rows)

    # ---------------------------------------------------------------- model_info
    ev = json.loads((C.REPORTS_DIR / "evaluation_summary.json").read_text())
    info = pd.DataFrame([{
        "model_version": version, "main_model": md["main_model"], "trained_at": md["created_at"], "dataset_hash": md["dataset_hash"],
        "git_commit": md.get("git_commit"), "seed": md["seed"], "n_train_rows": md["n_train_rows"],
        "train_months": json.dumps(md["train_months"]), "label_config": json.dumps(md["label"]),
        "holdout_metrics": json.dumps(md["metrics"]["holdout"]), "lift": json.dumps(md["metrics"]["lift"]),
        "cv_metrics": json.dumps(md["metrics"]["cv"]), "ablation": json.dumps(md["metrics"].get("ablation", {})),
        "calibration": json.dumps({k: v for k, v in md["metrics"]["calibration"].items()}),
        "shap_block_importance": json.dumps(ev["shap_block_importance"]), "top_features": json.dumps(ev["top_features"]),
        "error_analysis": json.dumps(ev["error_analysis"]), "n_features": len(art["features_B"]),
        "last_labeled_month": last_labeled_T, "last_scored_month": str(X["T"].max()),
    }])
    # ---------------------------------------------------------------- company_features (para /simulate y /score online)
    feats = X[["company_id", "T"] + art["features_B"]].copy()
    return {"company": company, "company_month_kpi": kpi, "risk_score": risk, "score_explanation": expl, "benchmark": bench,
            "model_info": info, "company_features": feats}


def write(tables: dict[str, pd.DataFrame]) -> None:
    eng = engine()
    with eng.begin() as con:
        for name, df in tables.items():
            df.to_sql(name, con, if_exists="replace", index=False, chunksize=5000)
        for stmt in [
            'CREATE INDEX IF NOT EXISTS ix_risk_company_T ON risk_score (company_id, "T")',
            'CREATE INDEX IF NOT EXISTS ix_risk_T ON risk_score ("T")',
            'CREATE INDEX IF NOT EXISTS ix_kpi_company_T ON company_month_kpi (company_id, "T")',
            'CREATE INDEX IF NOT EXISTS ix_expl_company_T ON score_explanation (company_id, "T")',
            'CREATE INDEX IF NOT EXISTS ix_bench ON benchmark ("T", size_cohort, country_group, group_bucket, kpi)',
            "CREATE INDEX IF NOT EXISTS ix_company ON company (company_id)",
            'CREATE INDEX IF NOT EXISTS ix_feat_company_T ON company_features (company_id, "T")',
        ]:
            con.execute(text(stmt))


def run() -> None:
    tables = build_tables()
    write(tables)
    for k, v in tables.items():
        print(f"  {k:20s} {len(v):>8,d} filas")
    print(f"[serve_db] escrito en {C.DATABASE_URL}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    run()
