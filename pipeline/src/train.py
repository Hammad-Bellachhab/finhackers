"""Capa 5 — Entrenamiento y validación temporal.

Diseño (Figura 5): validación cruzada temporal *expansiva* con embargo. Para evaluar el mes T_v
solo se entrena con filas cuyo T <= T_v − EMBARGO, donde EMBARGO = GAP + OUTCOME: exactamente
las etiquetas que ya se conocerían en T_v. El holdout (últimos meses etiquetados) se toca una
sola vez, al final, y no se usa para seleccionar nada.

Experimentos:
  * Modelo A ("proxy FICO", solo bloque A) vs. Modelo B (A + B…F), con LR y LightGBM (+ CatBoost).
  * Ablación por bloques sobre LightGBM-B.
  * Ensemble LightGBM+CatBoost solo si mejora AUC-PR en CV de forma medible.
  * Calibración Platt ajustada sobre predicciones out-of-fold; Brier antes/después.
  * Registro: pipeline completo (joblib) + booster nativo + metadata.json.
"""
from __future__ import annotations

import json
import subprocess
import sys
import time
import warnings
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score

from src import config as C
from src.features import CATEGORICAL, load_features
from src.labels import LABELS_PATH
from src.models import PlattCalibrator, make_pipeline

warnings.filterwarnings("ignore")
MIN_IMPROVEMENT_ENSEMBLE = 0.005


def embargo_months(outcome_months: int = C.OUTCOME_MONTHS) -> int:
    """Embargo = GAP + OUTCOME: en T_v solo se conocen etiquetas de filas con T <= T_v − embargo."""
    return C.GAP_MONTHS + outcome_months


EMBARGO = embargo_months()


# --------------------------------------------------------------------------------------
# Métricas
# --------------------------------------------------------------------------------------
def precision_at_k(y: np.ndarray, p: np.ndarray, k: int) -> float:
    idx = np.argsort(-p)[:k]
    return float(y[idx].mean()) if len(idx) else np.nan


def recall_at_k(y: np.ndarray, p: np.ndarray, k: int) -> float:
    idx = np.argsort(-p)[:k]
    return float(y[idx].sum() / max(y.sum(), 1))


def metrics(df: pd.DataFrame, pcol: str = "p") -> dict:
    """Métricas de un bloque de evaluación; las @k se calculan por mes (k = 50 empresas)."""
    y, p = df["y"].to_numpy(), df[pcol].to_numpy()
    out = {
        "n": int(len(df)), "positives": int(y.sum()),
        "auc_pr": float(average_precision_score(y, p)), "auc_roc": float(roc_auc_score(y, p)),
        "brier": float(brier_score_loss(y, p)), "base_rate": float(y.mean()),
    }
    per_month = df.groupby("T").apply(
        lambda d: pd.Series({"p@50": precision_at_k(d["y"].to_numpy(), d[pcol].to_numpy(), 50),
                             "r@50": recall_at_k(d["y"].to_numpy(), d[pcol].to_numpy(), 50),
                             "r@top10pct": recall_at_k(d["y"].to_numpy(), d[pcol].to_numpy(), max(1, int(0.10 * len(d))))}),
        include_groups=False)
    out.update({k: float(v) for k, v in per_month.mean().items()})
    return out


def bootstrap_ci(df: pd.DataFrame, cols: tuple[str, str], n_boot: int = 1000, seed: int = C.SEED) -> dict:
    """IC 95 % por bootstrap (remuestreo de filas) de AUC-PR de cada modelo y del lift B−A (pareado)."""
    rng = np.random.default_rng(seed)
    y = df["y"].to_numpy()
    pa, pb = df[cols[0]].to_numpy(), df[cols[1]].to_numpy()
    a, b, lift = [], [], []
    n = len(df)
    for _ in range(n_boot):
        i = rng.integers(0, n, n)
        if y[i].sum() == 0:
            continue
        sa, sb = average_precision_score(y[i], pa[i]), average_precision_score(y[i], pb[i])
        a.append(sa); b.append(sb); lift.append(sb - sa)
    q = lambda v: [float(np.percentile(v, 2.5)), float(np.percentile(v, 97.5))]
    return {"auc_pr_A_ci": q(a), "auc_pr_B_ci": q(b), "lift_ci": q(lift), "lift_mean": float(np.mean(lift)),
            "p_lift_le_0": float(np.mean(np.array(lift) <= 0))}


# --------------------------------------------------------------------------------------
# Datos y splits
# --------------------------------------------------------------------------------------
def load_dataset(labels: pd.DataFrame | None = None) -> tuple[pd.DataFrame, pd.DataFrame, dict]:
    X, meta = load_features()
    lab = (pd.read_parquet(LABELS_PATH) if labels is None else labels)[["company_id", "T", "y", "D"] + list(C.LABEL_WEIGHTS)]
    df = X.merge(lab, on=["company_id", "T"], how="inner").reset_index(drop=True)
    # las empresas reservadas para el test simulado no entran en ningún entrenamiento ni calibración
    test_ids = C.test_company_ids()
    if test_ids:
        df = df[~df["company_id"].isin(test_ids)].reset_index(drop=True)
    return df, X, meta


def feature_sets(meta: dict) -> dict[str, list[str]]:
    blocks = meta["blocks"]
    all_feats = [c for b in "ABCDEF" for c in blocks[b]]
    sets = {"A": list(blocks["A"]), "B": all_feats}
    for b in "BCDEF":
        sets[f"B_minus_{b}"] = [c for c in all_feats if c not in blocks[b]]
    sets["B_minus_A"] = [c for c in all_feats if c not in blocks["A"]]
    for b in "BCDEF":
        sets[f"A_plus_{b}"] = list(blocks["A"]) + list(blocks[b])
    return sets


def temporal_folds(df: pd.DataFrame, embargo: int = EMBARGO) -> tuple[list[dict], dict]:
    """Folds expansivos con embargo + holdout final. Devuelve (folds_cv, holdout)."""
    t_lab = sorted(df["t_idx"].unique())
    t_max = t_lab[-1]
    hold_eval = [t for t in t_lab if t > t_max - C.HOLDOUT_MONTHS]
    holdout = {"name": "holdout", "eval": hold_eval, "train_max": min(hold_eval) - embargo}
    # bloques de evaluación de 2 meses hacia atrás desde el holdout, mientras quede entrenamiento
    folds, hi = [], min(hold_eval) - 1
    while len(folds) < C.N_CV_FOLDS:
        ev = [t for t in (hi - 1, hi) if t in t_lab]
        train_max = min(ev) - embargo
        if train_max < 3:
            break
        folds.append({"name": f"fold{len(folds) + 1}", "eval": ev, "train_max": train_max})
        hi -= 2
    folds = list(reversed(folds))
    for i, f in enumerate(folds):
        f["name"] = f"fold{i + 1}"
    return folds, holdout


def split(df: pd.DataFrame, fold: dict) -> tuple[pd.DataFrame, pd.DataFrame]:
    tr = df[df["t_idx"] <= fold["train_max"]]
    ev = df[df["t_idx"].isin(fold["eval"])]
    return tr, ev


def fit_predict(model: str, feats: list[str], tr: pd.DataFrame, ev: pd.DataFrame, seed: int = C.SEED):
    num = [c for c in feats if c not in CATEGORICAL]
    cat = [c for c in feats if c in CATEGORICAL]
    pipe = make_pipeline(model, num, cat, seed=seed, pos_rate=float(tr["y"].mean()))
    pipe.fit(tr[feats], tr["y"])
    return pipe, pipe.predict_proba(ev[feats])[:, 1]


# --------------------------------------------------------------------------------------
# Experimentos
# --------------------------------------------------------------------------------------
def run_experiments(df: pd.DataFrame, sets: dict, folds: list[dict], holdout: dict, log=print, skip_ablation: bool = False) -> dict:
    results = {"folds": [{k: (v if k != "eval" else [int(x) for x in v]) for k, v in f.items()} for f in folds + [holdout]],
               "cv": {}, "holdout": {}, "ablation": {}}
    experiments = [("lr", "A"), ("lr", "B"), ("lgbm", "A"), ("lgbm", "B"), ("catboost", "B")]
    preds_holdout = df[df["t_idx"].isin(holdout["eval"])][["company_id", "T", "t_idx", "y"]].copy()
    oof = {}   # (model, set) -> DataFrame de predicciones out-of-fold en CV
    for model, fs in experiments:
        key = f"{model}_{fs}"
        per_fold, parts = [], []
        for f in folds:
            tr, ev = split(df, f)
            t0 = time.time()
            _, p = fit_predict(model, sets[fs], tr, ev)
            evp = ev[["company_id", "T", "t_idx", "y"]].assign(p=p)
            m = metrics(evp); m.update({"fold": f["name"], "n_train": int(len(tr)), "seconds": round(time.time() - t0, 1)})
            per_fold.append(m); parts.append(evp)
            log(f"  {key:12s} {f['name']}  train≤t{f['train_max']:<2d} n_tr={len(tr):>5d}  AUC-PR={m['auc_pr']:.3f}  AUC-ROC={m['auc_roc']:.3f}  p@50={m['p@50']:.2f}")
        oof[key] = pd.concat(parts)
        results["cv"][key] = {"per_fold": per_fold,
                              "auc_pr_mean": float(np.mean([m["auc_pr"] for m in per_fold])),
                              "auc_pr_std": float(np.std([m["auc_pr"] for m in per_fold])),
                              "auc_roc_mean": float(np.mean([m["auc_roc"] for m in per_fold]))}
        # holdout: una sola vez
        tr, ev = split(df, holdout)
        pipe, p = fit_predict(model, sets[fs], tr, ev)
        preds_holdout[key] = p
        results["holdout"][key] = metrics(preds_holdout.assign(p=p)) | {"n_train": int(len(tr))}
        log(f"  {key:12s} HOLDOUT train≤t{holdout['train_max']} n_tr={len(tr)}  AUC-PR={results['holdout'][key]['auc_pr']:.3f}  "
            f"AUC-ROC={results['holdout'][key]['auc_roc']:.3f}  p@50={results['holdout'][key]['p@50']:.2f}  brier={results['holdout'][key]['brier']:.3f}")

    # --- ensemble solo si aporta en CV ------------------------------------------------
    ens_oof = oof["lgbm_B"].copy()
    ens_oof["p"] = 0.5 * oof["lgbm_B"]["p"].to_numpy() + 0.5 * oof["catboost_B"]["p"].to_numpy()
    ens_cv = float(np.mean([metrics(ens_oof[ens_oof["t_idx"].isin(f["eval"])])["auc_pr"] for f in folds]))
    use_ens = ens_cv - results["cv"]["lgbm_B"]["auc_pr_mean"] >= MIN_IMPROVEMENT_ENSEMBLE
    results["ensemble"] = {"cv_auc_pr": ens_cv, "lgbm_cv_auc_pr": results["cv"]["lgbm_B"]["auc_pr_mean"], "selected": bool(use_ens)}
    preds_holdout["ens_B"] = 0.5 * preds_holdout["lgbm_B"] + 0.5 * preds_holdout["catboost_B"]
    results["holdout"]["ens_B"] = metrics(preds_holdout, "ens_B")
    log(f"  ensemble CV AUC-PR={ens_cv:.3f} vs lgbm {results['cv']['lgbm_B']['auc_pr_mean']:.3f} → {'SELECCIONADO' if use_ens else 'descartado'}")
    main_key = "ens_B" if use_ens else "lgbm_B"
    results["main_model"] = main_key

    # --- lift A vs B con IC bootstrap en holdout ---------------------------------------
    results["lift"] = {
        "lgbm": bootstrap_ci(preds_holdout, ("lgbm_A", "lgbm_B")),
        "lr": bootstrap_ci(preds_holdout, ("lr_A", "lr_B")),
        "lr_A_vs_main": bootstrap_ci(preds_holdout, ("lr_A", main_key)),
    }
    for k, v in results["lift"].items():
        log(f"  lift {k}: +{v['lift_mean']:.3f} AUC-PR  IC95=[{v['lift_ci'][0]:.3f}, {v['lift_ci'][1]:.3f}]  P(lift<=0)={v['p_lift_le_0']:.3f}")

    # --- ablación por bloques (LightGBM, CV + holdout) ----------------------------------
    for fs in [] if skip_ablation else ["B_minus_B", "B_minus_C", "B_minus_D", "B_minus_E", "B_minus_F", "B_minus_A",
               "A_plus_B", "A_plus_C", "A_plus_D", "A_plus_E", "A_plus_F"]:
        cv_scores = []
        for f in folds:
            tr, ev = split(df, f)
            _, p = fit_predict("lgbm", sets[fs], tr, ev)
            cv_scores.append(metrics(ev[["company_id", "T", "y"]].assign(p=p))["auc_pr"])
        tr, ev = split(df, holdout)
        _, p = fit_predict("lgbm", sets[fs], tr, ev)
        hm = metrics(ev[["company_id", "T", "y"]].assign(p=p))
        ref = "lgbm_A" if fs.startswith("A_plus") else "lgbm_B"
        results["ablation"][fs] = {"cv_auc_pr": float(np.mean(cv_scores)), "holdout_auc_pr": hm["auc_pr"],
                                   "holdout_auc_roc": hm["auc_roc"], "reference": ref,
                                   "delta_holdout": hm["auc_pr"] - results["holdout"][ref]["auc_pr"],
                                   "delta_cv": float(np.mean(cv_scores)) - results["cv"][ref]["auc_pr_mean"]}
        log(f"  ablación {fs:10s} vs {ref}: CV={np.mean(cv_scores):.3f} ({results['ablation'][fs]['delta_cv']:+.3f})  "
            f"holdout={hm['auc_pr']:.3f} ({results['ablation'][fs]['delta_holdout']:+.3f})")

    # --- generalización a empresas NO vistas (reto: test oculto) ---------------------------
    # 25 % de los grupos empresariales (grupo entero: sin hermanas a ambos lados) se apartan por completo;
    # se entrena con el resto (T <= train_max del holdout) y se evalúa en los meses de holdout de los apartados.
    rng = np.random.default_rng(C.SEED)
    groups = df["group_id"].fillna(df["company_id"]).unique()
    unseen_groups = set(rng.choice(groups, size=int(0.25 * len(groups)), replace=False))
    is_unseen = df["group_id"].fillna(df["company_id"]).isin(unseen_groups)
    tr_seen = df[(~is_unseen) & (df["t_idx"] <= holdout["train_max"])]
    ev_unseen = df[is_unseen & df["t_idx"].isin(holdout["eval"])]
    ev_seen = df[(~is_unseen) & df["t_idx"].isin(holdout["eval"])]
    results["holdout_unseen_companies"] = {"n_unseen_companies": int(ev_unseen["company_id"].nunique()), "n_train": int(len(tr_seen))}
    pu = {}
    for model, fs in [("lgbm", "A"), ("lgbm", "B")]:
        pipe, p_un = fit_predict(model, sets[fs], tr_seen, ev_unseen)
        p_se = pipe.predict_proba(ev_seen[sets[fs]])[:, 1]
        pu[fs] = p_un
        results["holdout_unseen_companies"][f"{model}_{fs}"] = {
            "unseen": metrics(ev_unseen[["company_id", "T", "y"]].assign(p=p_un)),
            "seen_same_model": metrics(ev_seen[["company_id", "T", "y"]].assign(p=p_se))}
        u, se = results["holdout_unseen_companies"][f"{model}_{fs}"]["unseen"], results["holdout_unseen_companies"][f"{model}_{fs}"]["seen_same_model"]
        log(f"  empresas NO vistas ({model}_{fs}): AUC-PR={u['auc_pr']:.3f} AUC-ROC={u['auc_roc']:.3f} (n={u['n']}, pos={u['positives']})  "
            f"| vistas, mismo modelo: AUC-PR={se['auc_pr']:.3f} AUC-ROC={se['auc_roc']:.3f}")
    results["holdout_unseen_companies"]["lift_lgbm"] = bootstrap_ci(ev_unseen[["y"]].assign(a=pu["A"], b=pu["B"]), ("a", "b"))
    lu = results["holdout_unseen_companies"]["lift_lgbm"]
    log(f"  lift B−A en empresas no vistas: +{lu['lift_mean']:.3f} AUC-PR  IC95=[{lu['lift_ci'][0]:.3f}, {lu['lift_ci'][1]:.3f}]")

    # --- calibración: Platt sobre OOF del modelo principal -------------------------------
    oof_main = oof["lgbm_B"].copy()
    if use_ens:
        oof_main["p"] = ens_oof["p"].to_numpy()
    cal = PlattCalibrator().fit(oof_main["p"], oof_main["y"])
    preds_holdout["p_main"] = preds_holdout[main_key]
    preds_holdout["p_main_cal"] = cal.transform(preds_holdout["p_main"])
    results["calibration"] = {
        "platt_a": cal.a_, "platt_b": cal.b_,
        "brier_raw": float(brier_score_loss(preds_holdout["y"], preds_holdout["p_main"])),
        "brier_cal": float(brier_score_loss(preds_holdout["y"], preds_holdout["p_main_cal"])),
        "curve": calibration_curve(preds_holdout["y"].to_numpy(), preds_holdout["p_main_cal"].to_numpy()),
    }
    log(f"  calibración Platt a={cal.a_:.2f} b={cal.b_:.2f}  Brier {results['calibration']['brier_raw']:.4f} → {results['calibration']['brier_cal']:.4f}")
    return results, preds_holdout, oof_main, cal


def calibration_curve(y: np.ndarray, p: np.ndarray, bins: int = 10) -> list[dict]:
    edges = np.linspace(0, 1, bins + 1)
    out = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (p >= lo) & (p < hi if hi < 1 else p <= hi)
        if m.sum() >= 10:
            out.append({"bin_lo": float(lo), "bin_hi": float(hi), "n": int(m.sum()),
                        "pred_mean": float(p[m].mean()), "obs_rate": float(y[m].mean())})
    return out


# --------------------------------------------------------------------------------------
# Registro de modelos (Capa 7)
# --------------------------------------------------------------------------------------
def git_commit() -> str | None:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=C.ROOT, stderr=subprocess.DEVNULL).decode().strip()
    except Exception:
        return None


def register(df: pd.DataFrame, X_all: pd.DataFrame, sets: dict, results: dict, cal: PlattCalibrator, meta: dict) -> str:
    """Entrena el modelo final sobre TODAS las filas etiquetadas y lo versiona con su metadata."""
    version = "v" + datetime.now().strftime("%Y%m%d_%H%M%S")
    out = C.REGISTRY_DIR / version
    out.mkdir(parents=True, exist_ok=True)
    feats_B, feats_A = sets["B"], sets["A"]
    pipe_B, _ = fit_predict("lgbm", feats_B, df, df.head(5))
    pipe_A, _ = fit_predict("lgbm", feats_A, df, df.head(5))
    pipes = {"lgbm_B": pipe_B, "lgbm_A": pipe_A}
    if results["main_model"] == "ens_B":
        pipes["catboost_B"], _ = fit_predict("catboost", feats_B, df, df.head(5))
    joblib.dump({"pipelines": pipes, "calibrator": cal, "features_B": feats_B, "features_A": feats_A,
                 "main_model": results["main_model"]}, out / "pipeline.joblib")
    # modelo "congelado" en el holdout (train T <= train_max): sirve para medir anticipación fuera de muestra
    hold = [f for f in results["folds"] if f["name"] == "holdout"][0]
    tr_h = df[df["t_idx"] <= hold["train_max"]]
    pipe_hB, _ = fit_predict("lgbm", feats_B, tr_h, tr_h.head(5))
    joblib.dump({"pipelines": {"lgbm_B": pipe_hB}, "calibrator": cal, "features_B": feats_B, "features_A": feats_A,
                 "main_model": "lgbm_B", "train_max_t_idx": int(hold["train_max"])}, out / "pipeline_holdout.joblib")
    pipe_B.named_steps["clf"].booster_.save_model(str(out / "lgbm_B.txt"))
    quality = json.loads((C.QUALITY_DIR / "quality_report_latest.json").read_text())
    md = {
        "version": version, "created_at": datetime.now(timezone.utc).isoformat(),
        "git_commit": git_commit(), "dataset_hash": quality["dataset_hash"], "seed": C.SEED,
        "label": {"outcome_months": C.OUTCOME_MONTHS, "gap_months": C.GAP_MONTHS, "percentile": C.TARGET_PERCENTILE,
                  "weights": C.LABEL_WEIGHTS, "embargo_months": EMBARGO},
        "main_model": results["main_model"],
        "hyperparameters": {k: v for k, v in pipe_B.named_steps["clf"].get_params().items() if not callable(v)},
        "input_schema": {"features_B": feats_B, "features_A": feats_A, "categorical": [c for c in feats_B if c in CATEGORICAL]},
        "n_train_rows": int(len(df)), "train_months": [str(df["T"].min()), str(df["T"].max())],
        "n_test_companies_excluded": len(C.test_company_ids()),
        "metrics": {"cv": results["cv"], "holdout": results["holdout"], "lift": results["lift"],
                    "ablation": results["ablation"], "calibration": results["calibration"], "ensemble": results["ensemble"],
                    "holdout_unseen_companies": results.get("holdout_unseen_companies", {})},
        "feature_blocks": meta["blocks"],
    }
    (out / "metadata.json").write_text(json.dumps(md, indent=2, ensure_ascii=False, default=str))
    (C.REGISTRY_DIR / "latest.txt").write_text(version)
    return version


def run(log=print, labels: pd.DataFrame | None = None, do_register: bool = True, skip_ablation: bool = False) -> dict:
    C.ensure_dirs()
    df, X_all, meta = load_dataset(labels)
    sets = feature_sets(meta)
    embargo = embargo_months(int(labels.attrs.get("outcome_months", C.OUTCOME_MONTHS)) if labels is not None else C.OUTCOME_MONTHS)
    folds, holdout = temporal_folds(df, embargo)
    months = C.month_range()
    log(f"[train] filas etiquetadas={len(df):,}  positivos={df['y'].mean():.3f}  features B={len(sets['B'])}  A={len(sets['A'])}  embargo={embargo}m")
    for f in folds + [holdout]:
        log(f"[train] {f['name']}: eval T={[months[t] for t in f['eval']]}  train T≤{months[f['train_max']]}")
    results, preds_holdout, oof_main, cal = run_experiments(df, sets, folds, holdout, log, skip_ablation=skip_ablation)
    if not do_register:
        return results
    version = register(df, X_all, sets, results, cal, meta)
    results["version"] = version
    (C.REPORTS_DIR / "train_results.json").write_text(json.dumps(results, indent=2, ensure_ascii=False, default=str))
    preds_holdout.to_parquet(C.REPORTS_DIR / "predictions_holdout.parquet", index=False)
    oof_main.to_parquet(C.REPORTS_DIR / "predictions_oof.parquet", index=False)
    log(f"[train] modelo registrado: {version}  (principal: {results['main_model']})")
    return results


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    run()
