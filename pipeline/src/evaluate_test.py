"""Evaluación sobre el test simulado: las empresas reservadas por split_test.py, puntuadas con predict.py
exactamente igual que se puntuaría el test oculto del reto, comparadas con lo que realmente les pasó.

    python -m src.evaluate_test        → reports/test_companies/ (predicciones) + reports/test_companies_eval.json

Estas empresas no han entrado en la definición de la etiqueta, ni en el entrenamiento, ni en la calibración:
todo lo que sale aquí es fuera de muestra en empresas Y en tiempo (las etiquetas se conocen a posteriori).
"""
from __future__ import annotations

import json
import subprocess
import sys

import pandas as pd
from sklearn.metrics import average_precision_score, roc_auc_score

from src import config as C
from src.evaluate import _clean, anticipation_analysis
from src.labels import LABELS_PATH
from src.train import bootstrap_ci, metrics

OUT_DIR = C.REPORTS_DIR / "test_companies"


def run(skip_predict: bool = False) -> dict:
    ids = sorted(C.test_company_ids())
    if not ids:
        raise SystemExit("no hay empresas de test: ejecuta antes `python -m src.split_test`")
    if not skip_predict:
        r = subprocess.run([sys.executable, "-m", "src.predict", "--raw", str(C.TEST_COMPANIES_DIR), "--out", str(OUT_DIR)],
                           cwd=C.ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace")
        if r.returncode != 0:
            raise SystemExit(f"predict.py falló:\n{r.stdout[-2000:]}\n{r.stderr[-3000:]}")
        print("\n".join(line for line in r.stdout.splitlines() if line.startswith("[predict]")))
    pred = pd.read_csv(OUT_DIR / "predictions.csv")
    lab = pd.read_parquet(LABELS_PATH)
    lab = lab[lab["company_id"].isin(ids)][["company_id", "T", "y", "D"]]
    df = pred.merge(lab, on=["company_id", "T"], how="inner")
    if df.empty:
        raise SystemExit("las predicciones no casan con las etiquetas (¿meses distintos?)")
    y = df["y"].to_numpy()
    out = {
        "n_test_companies": len(ids), "n_rows_labeled": int(len(df)), "positives": int(y.sum()), "base_rate": float(y.mean()),
        "labeled_months": [df["T"].min(), df["T"].max()],
        "model_B": metrics(df.assign(p=df["p_deterioro"])),
        "model_A": metrics(df.assign(p=df["p_modelo_A"])),
        "lift_B_vs_A": bootstrap_ci(df.assign(a=df["p_modelo_A"], b=df["p_deterioro"]), ("a", "b")),
        "health_as_score": {"auc_roc": float(roc_auc_score(y, -df["health_smooth"])), "auc_pr": float(average_precision_score(y, -df["health_smooth"]))},
        "by_month": {T: {"n": int(len(g)), "positives": int(g["y"].sum()),
                         "auc_roc": float(roc_auc_score(g["y"], g["p_deterioro"])) if g["y"].nunique() > 1 else None,
                         "auc_pr": float(average_precision_score(g["y"], g["p_deterioro"])) if g["y"].sum() else None}
                     for T, g in df.groupby("T")},
    }
    # --- bidireccional: ¿la banda/trayectoria de hoy distingue a las que se deterioran en los 6 meses siguientes? ----
    bands = df.groupby("health_band")["y"].agg(["mean", "size"]).rename(columns={"mean": "share_deteriorate", "size": "n"})
    traj = df.groupby("trajectory")["y"].agg(["mean", "size"]).rename(columns={"mean": "share_deteriorate", "size": "n"})
    out["deterioration_rate_by_band"] = {k: {"share_deteriorate": float(v["share_deteriorate"]), "n": int(v["n"])} for k, v in bands.iterrows()}
    out["deterioration_rate_by_trajectory"] = {k: {"share_deteriorate": float(v["share_deteriorate"]), "n": int(v["n"])} for k, v in traj.iterrows()}
    exc = df[df["is_exceptional"]]
    out["exceptional_companies"] = {"n_rows": int(len(exc)), "share_deteriorate": float(exc["y"].mean()) if len(exc) else None}
    # --- anticipación en las empresas de test (scores de predict.py: fuera de muestra en todos los meses) ----------
    months = C.month_range()
    Xt = pred[["company_id", "T"]].copy()
    Xt["t_idx"] = Xt["T"].map({m: i for i, m in enumerate(months)})
    sc = pred[["company_id", "T", "health_smooth", "trajectory", "health_band"]]
    antic, ev = anticipation_analysis(Xt, None, months, scores=sc, t_min=0)
    out["anticipation"] = antic
    out = _clean(out)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (C.REPORTS_DIR / "test_companies_eval.json").write_text(json.dumps(out, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
    ev.to_csv(OUT_DIR / "anticipation_events.csv", index=False)
    mb, ma, lift = out["model_B"], out["model_A"], out["lift_B_vs_A"]
    print(f"[test] {len(ids)} empresas nunca vistas · {len(df):,} filas etiquetadas · base rate {y.mean():.1%}")
    print(f"[test] Modelo B: AUC-ROC={mb['auc_roc']:.3f} AUC-PR={mb['auc_pr']:.3f} p@50={mb['p@50']:.2f}  |  Modelo A: AUC-ROC={ma['auc_roc']:.3f} AUC-PR={ma['auc_pr']:.3f}")
    print(f"[test] lift B−A: +{lift['lift_mean']:.3f} AUC-PR  IC95=[{lift['lift_ci'][0]:.3f}, {lift['lift_ci'][1]:.3f}]")
    print("[test] % que se deteriora según banda de salud:", {k: f"{v['share_deteriorate']:.0%} (n={v['n']})" for k, v in out["deterioration_rate_by_band"].items()})
    print("[test] % que se deteriora según trayectoria:", {k: f"{v['share_deteriorate']:.0%} (n={v['n']})" for k, v in out["deterioration_rate_by_trajectory"].items()})
    if antic.get("n_events"):
        print(f"[test] anticipación: {antic['n_events']} eventos, anticipados {antic['share_anticipated'] or 0:.0%}, mediana {antic['lead_months_median']} meses, falsas alertas {antic['false_alert_rate'] or 0:.0%}")
    return out


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    run(skip_predict="--skip-predict" in sys.argv)
