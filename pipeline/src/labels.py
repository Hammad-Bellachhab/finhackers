"""Capa 3 — Etiquetado (target engineering).

No existe variable objetivo: se construye un índice compuesto de deterioro D sobre la
ventana de resultado (T + GAP + 1 … T + GAP + OUTCOME) y se binariza por percentil.

    D_i = sum_k w_k · z_ik        y_i = 1[ D_i > Q_p(D) ]

Componentes (cada uno z-score dentro de su cohorte de tamaño, winsorizado al 1–99 %):
    late_pay_rate    % facturas *a pagar* vencidas en la ventana con DPD > 30 (o impagadas > 30 d)
    neg_cash_share   % meses de la ventana con caja reconstruida (cuentas corrientes) < 0
    collection_drop  caída de cobros operativos medios vs. los 6 meses previos a T
    credit_util      utilización media de líneas de crédito (dispuesto / concedido)
    inactivity       % meses de la ventana sin ninguna transacción

Regla dura anti-fuga: NADA de lo que se calcula aquí toca fechas <= T. Las mismas magnitudes,
medidas en la ventana de observación, sí pueden ser features (Capa 4).
"""
from __future__ import annotations

import json
import sys

import numpy as np
import pandas as pd

from src import config as C
from src.schema import load_cm

LABELS_PATH = C.PARQUET_DIR / "labels.parquet"


def month_index(months: list[str]) -> dict[str, int]:
    return {m: i for i, m in enumerate(months)}


def _pivot(df: pd.DataFrame, col: str, months: list[str], companies: pd.Index, fill=np.nan) -> pd.DataFrame:
    """Matriz empresa × mes de una columna (filas = companies, columnas = months)."""
    p = df.pivot(index="company_id", columns="T", values=col)
    return p.reindex(index=companies, columns=months).astype(float).fillna(fill) if fill is not np.nan \
        else p.reindex(index=companies, columns=months).astype(float)


def _window_sum(mat: np.ndarray, start: int, end: int) -> np.ndarray:
    """Suma sobre columnas [start, end) para cada fila; NaN-aware (todo NaN → NaN)."""
    sub = mat[:, start:end]
    allnan = np.isnan(sub).all(axis=1)
    out = np.nansum(sub, axis=1)
    out[allnan] = np.nan
    return out


def build_labels(outcome_months: int = C.OUTCOME_MONTHS, gap_months: int = C.GAP_MONTHS,
                 percentile: float = C.TARGET_PERCENTILE, save: bool = True) -> pd.DataFrame:
    months = C.month_range()
    n_m = len(months)

    tx = load_cm("cm_tx")
    cash = load_cm("cm_cash")
    outc = load_cm("cm_invoice_outcome")
    companies = pd.Index(sorted(tx["company_id"].unique()))

    # --- matrices empresa × mes ----------------------------------------------------------
    n_tx = _pivot(tx, "n_tx", months, companies, fill=0.0)
    inflow = _pivot(tx, "inflow_oper", months, companies, fill=0.0)
    cash_bal = _pivot(cash, "cash_balance", months, companies)
    credit_drawn = _pivot(cash, "credit_drawn", months, companies)
    credit_granted = _pivot(cash, "credit_granted", months, companies)
    pay = outc[outc["is_payable"]].rename(columns={"due_month": "T"})
    n_class = _pivot(pay, "n_classifiable", months, companies, fill=0.0)
    n_bad = _pivot(pay, "n_bad", months, companies, fill=0.0)
    first_active = pd.Series(np.argmax(n_tx.values > 0, axis=1), index=companies)

    # --- último T etiquetable: la ventana de resultado debe caber en los datos ---------
    last_label_idx = n_m - 1 - gap_months - outcome_months
    rows = []
    for t in range(0, last_label_idx + 1):
        o0, o1 = t + gap_months + 1, t + gap_months + 1 + outcome_months   # ventana de resultado [o0, o1)
        p0 = max(0, t - 5)                                                 # 6 meses previos a T (incl.)
        # elegibilidad: activa en los 3 meses hasta T (incl.) y ya en el panel
        active_3m = n_tx.values[:, max(0, t - 2):t + 1].sum(axis=1) > 0
        n_cls = _window_sum(n_class.values, o0, o1)
        n_bd = _window_sum(n_bad.values, o0, o1)
        late_pay_rate = np.where(n_cls >= 3, n_bd / np.where(n_cls > 0, n_cls, np.nan), np.nan)
        cb = cash_bal.values[:, o0:o1]
        neg_cash_share = np.where(np.isnan(cb).all(axis=1), np.nan, np.nanmean(cb < 0, axis=1))
        inflow_out = inflow.values[:, o0:o1].mean(axis=1)
        inflow_prev = inflow.values[:, p0:t + 1].mean(axis=1)
        collection_drop = np.where(inflow_prev > 0, 1 - inflow_out / np.where(inflow_prev > 0, inflow_prev, np.nan), np.nan)
        collection_drop = np.clip(collection_drop, -1, 1)
        cg = credit_granted.values[:, o0:o1]
        cd = credit_drawn.values[:, o0:o1]
        util = np.where(cg > 0, cd / np.where(cg > 0, cg, np.nan), np.nan)
        credit_util = np.where(np.isnan(util).all(axis=1), np.nan, np.nanmean(util, axis=1))
        inactivity = (n_tx.values[:, o0:o1] == 0).mean(axis=1)
        # tamaño para la cohorte: salida operativa media en los 6 meses previos
        size = _pivot(tx, "outflow_oper", months, companies, fill=0.0).values[:, p0:t + 1].mean(axis=1)
        df = pd.DataFrame({
            "company_id": companies, "T": months[t], "t_idx": t,
            "eligible": active_3m & (first_active.values <= t),
            "late_pay_rate": late_pay_rate, "neg_cash_share": neg_cash_share,
            "collection_drop": collection_drop, "credit_util": credit_util, "inactivity": inactivity,
            "size_outflow_6m": size,
        })
        rows.append(df)
    lab = pd.concat(rows, ignore_index=True)
    lab = lab[lab["eligible"]].drop(columns="eligible").reset_index(drop=True)

    # --- empresas reservadas para el test simulado: la definición se AJUSTA sin ellas y se les APLICA -----
    test_ids = C.test_company_ids()
    lab["is_test_company"] = lab["company_id"].isin(test_ids)
    fit = ~lab["is_test_company"]

    # --- cohortes de tamaño (cuartiles de salida operativa, cortes fijados en entrenamiento) ----------------
    edges = np.quantile(lab.loc[fit, "size_outflow_6m"], [0.25, 0.5, 0.75])
    lab["size_cohort"] = pd.cut(lab["size_outflow_6m"], [-np.inf, *edges, np.inf], labels=["q1", "q2", "q3", "q4"]).astype(str)

    # --- z-scores por cohorte, winsorizados (límites, medias y desviaciones de entrenamiento) ----------------
    comps = list(C.LABEL_WEIGHTS)
    for c in comps:
        lo, hi = lab.loc[fit, c].quantile([0.01, 0.99])
        v = lab[c].clip(lo, hi)
        stats = v[fit].groupby(lab.loc[fit, "size_cohort"]).agg(["mean", "std"])
        mu = lab["size_cohort"].map(stats["mean"]); sd = lab["size_cohort"].map(stats["std"]).replace(0, np.nan)
        lab[f"z_{c}"] = (v - mu) / sd
    Z = lab[[f"z_{c}" for c in comps]].to_numpy()
    W = np.array([C.LABEL_WEIGHTS[c] for c in comps])
    avail = ~np.isnan(Z)
    wsum = (avail * W).sum(axis=1)
    D = np.where(wsum > 0, np.nansum(Z * W, axis=1) / np.where(wsum > 0, wsum, np.nan), np.nan)
    lab["n_components"] = avail.sum(axis=1)
    lab["D"] = D
    lab = lab[lab["n_components"] >= 2].reset_index(drop=True)   # al menos dos señales disponibles
    thr = float(np.nanquantile(lab.loc[~lab["is_test_company"], "D"], percentile))   # umbral solo con entrenamiento
    lab["y"] = (lab["D"] > thr).astype(int)
    lab["threshold"] = thr

    meta = {
        "outcome_months": outcome_months, "gap_months": gap_months, "percentile": percentile,
        "threshold_D": thr, "n_rows": int(len(lab)), "positive_rate": float(lab["y"].mean()),
        "n_companies": int(lab["company_id"].nunique()),
        "n_test_companies": int(lab.loc[lab["is_test_company"], "company_id"].nunique()),
        "positive_rate_test_companies": float(lab.loc[lab["is_test_company"], "y"].mean()) if lab["is_test_company"].any() else None,
        "labeled_months": [months[0], months[last_label_idx]],
        "weights": C.LABEL_WEIGHTS,
        "positive_rate_by_month": lab.groupby("T")["y"].mean().round(3).to_dict(),
        "component_availability": {c: float(lab[c].notna().mean()) for c in comps},
        "component_corr_with_D": {c: float(lab[[c, "D"]].corr().iloc[0, 1]) for c in comps},
    }
    if save:
        lab.to_parquet(LABELS_PATH, index=False)
        (C.REPORTS_DIR / "labels_meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False))
    return lab, meta


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    C.ensure_dirs()
    lab, meta = build_labels()
    print(f"[labels] filas={meta['n_rows']:,}  empresas={meta['n_companies']}  positivos={meta['positive_rate']:.3f}  "
          f"umbral D={meta['threshold_D']:.3f}  T∈{meta['labeled_months']}")
    print("[labels] disponibilidad componentes:", {k: round(v, 2) for k, v in meta["component_availability"].items()})
    print("[labels] corr(componente, D):", {k: round(v, 2) for k, v in meta["component_corr_with_D"].items()})
    print("[labels] tasa positivos por mes:", meta["positive_rate_by_month"])
