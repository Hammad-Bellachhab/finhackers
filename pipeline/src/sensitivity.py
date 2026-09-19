"""Análisis de sensibilidad del target (decisiones abiertas §16): ventana de resultado 3 vs 6 meses
y umbral percentil 85 vs 90. Reentrena A vs B (LR + LightGBM + CatBoost) con la validación
temporal de la Capa 5 para cada variante y guarda reports/sensitivity.json. No toca el registro.
"""
from __future__ import annotations

import json
import sys

from src import config as C
from src.labels import build_labels
from src.train import run

VARIANTS = [(6, 0.85), (3, 0.85), (6, 0.90), (3, 0.90)]


def main():
    out = {}
    for o, p in VARIANTS:
        name = f"outcome{o}m_p{int(p * 100)}"
        print(f"\n=== variante {name} ===")
        lab, meta = build_labels(outcome_months=o, percentile=p, save=False)
        lab.attrs["outcome_months"] = o
        res = run(labels=lab, do_register=False, skip_ablation=True, log=lambda s: print(s) if "HOLDOUT" in s or "lift" in s or "[train]" in s else None)
        out[name] = {
            "outcome_months": o, "percentile": p, "n_rows": meta["n_rows"], "positive_rate": meta["positive_rate"],
            "folds": res["folds"],
            "holdout": {k: {m: v[m] for m in ("auc_pr", "auc_roc", "p@50", "brier", "n", "positives")} for k, v in res["holdout"].items()},
            "cv": {k: {"auc_pr_mean": v["auc_pr_mean"], "auc_pr_std": v["auc_pr_std"]} for k, v in res["cv"].items()},
            "lift": res["lift"], "main_model": res["main_model"],
        }
    (C.REPORTS_DIR / "sensitivity.json").write_text(json.dumps(out, indent=2, ensure_ascii=False, default=str))
    print("\n=== resumen (holdout) ===")
    print(f"{'variante':18s} {'filas':>6s} {'A lgbm':>8s} {'B lgbm':>8s} {'B cat':>8s} {'lift lgbm':>10s} {'IC95':>18s}")
    for k, v in out.items():
        h, lg = v["holdout"], v["lift"]["lgbm"]
        print(f"{k:18s} {v['n_rows']:>6d} {h['lgbm_A']['auc_pr']:>8.3f} {h['lgbm_B']['auc_pr']:>8.3f} {h['catboost_B']['auc_pr']:>8.3f} "
              f"{lg['lift_mean']:>+10.3f} [{lg['lift_ci'][0]:+.3f}, {lg['lift_ci'][1]:+.3f}]")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
