"""Capa 9 — Servicio de inferencia: pipeline cargado una vez, score + calibración + SHAP local.

Dos modos: batch (serve_db.py vuelca risk_score) y online (POST /score, POST /simulate).
"""
from __future__ import annotations

from datetime import datetime, timezone

import numpy as np
import pandas as pd

from src import config as C
from src.evaluate import describe, load_registry, score_main, shap_values
from src.features import CATEGORICAL

# Escenarios "de tesorero" → deltas sobre features (el simulador de la Capa 11).
SCENARIOS = {
    "client_pays_late_30d": {
        "label": "El cliente principal paga 30 días más tarde",
        "apply": lambda r: {
            "rec_dpd_mean_w3": r.get("rec_dpd_mean_w3", 0) + 30, "rec_dpd_mean_w6": r.get("rec_dpd_mean_w6", 0) + 15,
            "rec_open_overdue_share_w3": min(1.0, r.get("rec_open_overdue_share_w3", 0) + 0.25),
            "rec_open_overdue_share_w6": min(1.0, r.get("rec_open_overdue_share_w6", 0) + 0.12),
            "cash_conversion_days_w6": r.get("cash_conversion_days_w6", 30) + 30,
            "cash_months_of_outflow": r.get("cash_months_of_outflow", 0) - (r.get("top1_in_share", 0.3) or 0.3),
            "days_of_cash": r.get("days_of_cash", 0) - 30 * (r.get("top1_in_share", 0.3) or 0.3),
        }},
    "lose_main_client": {
        "label": "Se pierde el cliente principal (cobros −top1)",
        "apply": lambda r: (lambda s: {
            "inflow_w1_log": np.log1p(np.expm1(r.get("inflow_w1_log", 0)) * (1 - s)),
            "inflow_w3_log": np.log1p(np.expm1(r.get("inflow_w3_log", 0)) * (1 - s / 3)),
            "io_ratio_w1": r.get("io_ratio_w1", 1) * (1 - s), "io_ratio_w3": r.get("io_ratio_w3", 1) * (1 - s / 3),
            "inflow_w3_vs_w12": r.get("inflow_w3_vs_w12", 1) * (1 - s / 3), "net_flow_norm_w3": r.get("net_flow_norm_w3", 0) - s / 3,
            "inflow_trend6": r.get("inflow_trend6", 0) - 0.1, "cp_in_churn": min(1.0, (r.get("cp_in_churn", 0) or 0) + 0.2),
        })(r.get("top1_in_share", 0.3) or 0.3)},
    "pay_suppliers_late_15d": {
        "label": "Se retrasa 15 días el pago a proveedores",
        "apply": lambda r: {
            "pay_dpd_mean_w3": r.get("pay_dpd_mean_w3", 0) + 15, "pay_dpd_mean_w6": r.get("pay_dpd_mean_w6", 0) + 8,
            "pay_open_overdue_share_w3": min(1.0, r.get("pay_open_overdue_share_w3", 0) + 0.15),
            "pay_bad_share_w3": min(1.0, r.get("pay_bad_share_w3", 0) + 0.10), "pay_dpd_trend6": r.get("pay_dpd_trend6", 0) + 3,
        }},
    "overdraft_2_months": {
        "label": "Dos meses en descubierto",
        "apply": lambda r: {
            "cash_neg_months_w3": 2, "cash_neg_months_w6": r.get("cash_neg_months_w6", 0) + 2,
            "cash_balance_T_log": -abs(r.get("outflow_w1_log", 8)) * 0.8, "cash_months_of_outflow": -0.8, "days_of_cash": -24,
            "interest_n_w3": r.get("interest_n_w3", 0) + 2, "interest_n_w6": r.get("interest_n_w6", 0) + 2,
        }},
    "new_credit_line": {
        "label": "Se contrata una línea de crédito (caja +2 meses de gasto)",
        "apply": lambda r: {
            "cash_months_of_outflow": r.get("cash_months_of_outflow", 0) + 2, "days_of_cash": r.get("days_of_cash", 0) + 60,
            "cash_balance_T_log": np.log1p(max(0, np.sign(r.get("cash_balance_T_log", 0)) * np.expm1(abs(r.get("cash_balance_T_log", 0))) + 2 * np.expm1(r.get("outflow_w1_log", 8)))),
            "n_credit_lines": r.get("n_credit_lines", 0) + 1, "n_debt_products": r.get("n_debt_products", 0) + 1,
            "cash_neg_months_w3": 0,
        }},
}


class InferenceService:
    def __init__(self, version: str | None = None):
        self.art, self.md, self.version = load_registry(version)
        self.features: list[str] = self.art["features_B"]
        self.block_of = {f: b for b, fs in self.md["feature_blocks"].items() for f in fs}
        self.art["block_of"] = self.block_of
        self.loaded_at = datetime.now(timezone.utc).isoformat()

    # --- utilidades -------------------------------------------------------------------
    def frame(self, payload: dict) -> pd.DataFrame:
        """Construye una fila de features a partir de un dict; lo que falta → NaN / 'UNK'."""
        row = {}
        for f in self.features:
            v = payload.get(f)
            if f in CATEGORICAL:
                row[f] = "UNK" if v is None else str(v)
            else:
                try:
                    row[f] = np.nan if v is None else float(v)
                except (TypeError, ValueError):
                    row[f] = np.nan
        return pd.DataFrame([row])

    def band(self, p: float) -> str:
        for lo, hi, name in C.RISK_BANDS:
            if lo <= p < hi:
                return name
        return C.RISK_BANDS[-1][2]

    # --- scoring -----------------------------------------------------------------------
    def score(self, payload: dict, top_n: int = C.TOP_N_SHAP) -> dict:
        X = self.frame(payload)
        p_raw = float(score_main(self.art, X, calibrated=False)[0])
        p_cal = float(score_main(self.art, X, calibrated=True)[0])
        S = shap_values(self.art, X).iloc[0]
        contrib = S[self.features].astype(float)
        order = contrib.abs().sort_values(ascending=False).index[:top_n]
        expl = [{"feature": f, "block": self.block_of.get(f, ""), "value": (None if pd.isna(X.iloc[0][f]) or f in CATEGORICAL else float(X.iloc[0][f])),
                 "shap": float(contrib[f]), "direction": "sube" if contrib[f] > 0 else "baja",
                 "text": describe(f, X.iloc[0][f])} for f in order]
        return {"score": p_cal, "score_raw": p_raw, "band": self.band(p_cal), "model_version": self.version,
                "explanation": expl, "base_value": float(S["_base"]),
                "unknown_features": sorted(set(payload) - set(self.features))}

    def simulate(self, base: dict, overrides: dict | None = None, scenario: str | None = None) -> dict:
        before = self.score(base)
        new = dict(base)
        applied = {}
        if scenario:
            if scenario not in SCENARIOS:
                raise KeyError(scenario)
            applied.update(SCENARIOS[scenario]["apply"]({k: v for k, v in base.items() if isinstance(v, (int, float)) and not pd.isna(v)}))
        if overrides:
            applied.update(overrides)
        new.update(applied)
        after = self.score(new)
        return {"scenario": scenario, "scenario_label": SCENARIOS[scenario]["label"] if scenario else None,
                "applied_changes": {k: (None if v is None or (isinstance(v, float) and np.isnan(v)) else float(v)) for k, v in applied.items()},
                "before": {k: before[k] for k in ("score", "band")}, "after": {k: after[k] for k in ("score", "band")},
                "delta": after["score"] - before["score"], "explanation_after": after["explanation"], "model_version": self.version}

    def info(self) -> dict:
        m = self.md["metrics"]
        return {"model_version": self.version, "main_model": self.md["main_model"], "trained_at": self.md["created_at"],
                "loaded_at": self.loaded_at, "dataset_hash": self.md["dataset_hash"], "git_commit": self.md.get("git_commit"),
                "seed": self.md["seed"], "n_features": len(self.features), "n_train_rows": self.md["n_train_rows"],
                "train_months": self.md["train_months"], "label": self.md["label"],
                "holdout": m["holdout"], "lift": m["lift"], "cv": {k: {"auc_pr_mean": v["auc_pr_mean"], "auc_pr_std": v["auc_pr_std"]} for k, v in m["cv"].items()},
                "calibration": {k: v for k, v in m["calibration"].items() if k != "curve"}, "ablation": m.get("ablation", {}),
                "feature_blocks": {b: len(fs) for b, fs in self.md["feature_blocks"].items()},
                "scenarios": {k: v["label"] for k, v in SCENARIOS.items()}}
