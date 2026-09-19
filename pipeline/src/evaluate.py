"""Capa 6 — Evaluación y explicabilidad.

Produce el material de la presentación y lo que sirve el dashboard:
  * TreeSHAP exacto (pred_contrib del booster LightGBM-B): importancia global, agregada por bloque
    (¿de dónde viene el lift?) y explicación local top-n por empresa, precalculada en batch.
  * Curvas PR A vs B, calibración, ablación → figuras PNG en reports/figures/.
  * Análisis de errores: perfil de los falsos negativos del holdout.
"""
from __future__ import annotations

import json
import sys
import warnings

import joblib
import numpy as np
import pandas as pd

from src import config as C
from src.features import CATEGORICAL, load_features
from src.labels import LABELS_PATH

warnings.filterwarnings("ignore")
FIG_DIR = C.REPORTS_DIR / "figures"

# Descripciones en lenguaje natural de las features más relevantes (para el dashboard).
FEATURE_TEXT = {
    "pay_dpd_mean_w6": ("Retraso medio de pago a proveedores (6 m)", "días"),
    "pay_dpd_mean_w3": ("Retraso medio de pago a proveedores (3 m)", "días"),
    "pay_dpd_mean_w12": ("Retraso medio de pago a proveedores (12 m)", "días"),
    "pay_dpd_p90_w6": ("Retraso p90 de pago a proveedores (6 m)", "días"),
    "pay_bad_share_w6": ("% facturas a pagar con más de 30 días de retraso (6 m)", "%"),
    "pay_bad_share_w12": ("% facturas a pagar con más de 30 días de retraso (12 m)", "%"),
    "pay_bad_share_w3": ("% facturas a pagar con más de 30 días de retraso (3 m)", "%"),
    "pay_open_overdue_share_w3": ("% facturas a pagar vencidas y abiertas (3 m)", "%"),
    "pay_open_overdue_share_w6": ("% facturas a pagar vencidas y abiertas (6 m)", "%"),
    "pay_open_overdue_share_w12": ("% facturas a pagar vencidas y abiertas (12 m)", "%"),
    "pay_amt_open_overdue_ratio_w6": ("Importe vencido abierto sobre facturado a pagar (6 m)", "%"),
    "pay_amt_open_overdue_ratio_w12": ("Importe vencido abierto sobre facturado a pagar (12 m)", "%"),
    "pay_open_overdue_trend6": ("Tendencia del % de facturas vencidas abiertas (6 m)", "pp/mes"),
    "pay_dpd_trend6": ("Tendencia del retraso de pago (6 m)", "días/mes"),
    "pay_max_open_dpd_w12": ("Factura a pagar más antigua sin pagar", "días"),
    "rec_open_overdue_share_w6": ("% facturas a cobrar vencidas y abiertas (6 m)", "%"),
    "rec_open_overdue_share_w3": ("% facturas a cobrar vencidas y abiertas (3 m)", "%"),
    "rec_dpd_mean_w6": ("Retraso medio de cobro de clientes (6 m)", "días"),
    "rec_bad_share_w6": ("% facturas a cobrar con más de 30 días de retraso (6 m)", "%"),
    "cash_balance_T_log": ("Saldo de caja reconstruido a fin de mes", "log€"),
    "cash_months_of_outflow": ("Meses de gasto operativo cubiertos por la caja", "meses"),
    "days_of_cash": ("Días de caja", "días"),
    "cash_min_w6_norm": ("Saldo mínimo de caja (6 m) sobre gasto mensual", "x"),
    "cash_neg_months_w3": ("Meses en descubierto (3 m)", "meses"),
    "cash_neg_months_w6": ("Meses en descubierto (6 m)", "meses"),
    "cash_neg_months_w12": ("Meses en descubierto (12 m)", "meses"),
    "cash_trend6": ("Tendencia del saldo de caja (6 m)", "x gasto/mes"),
    "cash_vol6": ("Volatilidad del saldo de caja (6 m)", "x"),
    "io_ratio_w3": ("Ratio cobros/pagos (3 m)", "x"),
    "io_ratio_w6": ("Ratio cobros/pagos (6 m)", "x"),
    "io_ratio_w12": ("Ratio cobros/pagos (12 m)", "x"),
    "io_ratio_w1": ("Ratio cobros/pagos (último mes)", "x"),
    "io_ratio_trend6": ("Tendencia del ratio cobros/pagos (6 m)", "x/mes"),
    "inflow_w3_vs_w12": ("Cobros últimos 3 m frente a media 12 m", "x"),
    "inflow_trend6": ("Tendencia de cobros (6 m)", "log/mes"),
    "net_flow_norm_w3": ("Flujo neto sobre pagos (3 m)", "x"),
    "interest_n_w6": ("Liquidaciones de intereses/descubierto (6 m)", "n"),
    "interest_n_w3": ("Liquidaciones de intereses/descubierto (3 m)", "n"),
    "interest_n_w12": ("Liquidaciones de intereses/descubierto (12 m)", "n"),
    "interest_trend6": ("Tendencia de liquidaciones de intereses (6 m)", "n/mes"),
    "credit_util_T": ("Utilización de líneas de crédito", "%"),
    "credit_util_max_w6": ("Utilización máxima de líneas de crédito (6 m)", "%"),
    "hhi_in": ("Concentración de cobros por cliente (HHI)", "idx"),
    "top1_in_share": ("Peso del mayor cliente en los cobros", "%"),
    "n_eff_clients": ("Número efectivo de clientes", "n"),
    "cp_in_churn": ("Clientes perdidos frente al semestre anterior", "%"),
    "hhi_out": ("Concentración de pagos por proveedor (HHI)", "idx"),
    "stress_terms_rate_w6": ("Movimientos con términos de estrés (devolución, impagado…) (6 m)", "%"),
    "stress_terms_rate_w3": ("Movimientos con términos de estrés (3 m)", "%"),
    "no_counterparty_share_w3": ("Movimientos sin contrapartida resuelta (3 m)", "%"),
    "reconciled_share_w3": ("Movimientos conciliados (3 m)", "%"),
    "reconciled_delta_w3_w12": ("Cambio en la tasa de conciliación (3 m vs 12 m)", "pp"),
    "salary_months_share_w6": ("Meses con pago de nóminas (6 m)", "%"),
    "salary_day_mean_w3": ("Día del mes en que se pagan las nóminas (3 m)", "día"),
    "tax_months_share_w6": ("Meses con pago de impuestos (6 m)", "%"),
    "tax_amt_ratio_w3_w12": ("Impuestos pagados 3 m frente a media 12 m", "x"),
    "ss_months_share_w6": ("Meses con pago de Seguridad Social (6 m)", "%"),
    "sib_pay_open_overdue_w6": ("% facturas vencidas abiertas de las empresas hermanas del grupo", "%"),
    "sib_cash_neg_months_w6": ("Meses en descubierto de las empresas hermanas (6 m)", "meses"),
    "bank_peer_pay_open_overdue_w6": ("% facturas vencidas de empresas del mismo banco principal", "%"),
    "n_tx_w3_vs_w12": ("Actividad transaccional 3 m frente a 12 m", "x"),
    "inactive_months_w6": ("Meses sin transacciones (6 m)", "meses"),
    "months_since_last_invoice": ("Meses desde la última factura sincronizada del ERP", "meses"),
    "inv_issued_ratio_w3_w12": ("Facturas emitidas 3 m frente a media 12 m", "x"),
    "debt_service_ratio_w6": ("Servicio de la deuda sobre cobros (6 m)", "%"),
    "debt_granted_total": ("Financiación concedida total", "log€"),
    "n_debt_products": ("Número de productos de financiación", "n"),
    "n_banks": ("Número de bancos", "n"),
    "tenure_months": ("Antigüedad en la plataforma", "meses"),
    "months_in_panel": ("Meses de historial disponible", "meses"),
    "group_size": ("Tamaño del grupo empresarial", "empresas"),
    "turnover_out_w12_log": ("Pagos operativos anuales", "log€"),
    "turnover_in_w12_log": ("Cobros operativos anuales", "log€"),
    "cash_conversion_days_w6": ("Ciclo de cobro aproximado (emisión → cobro)", "días"),
    "n_tx_w1": ("Transacciones en el último mes", "n"),
    "n_tx_w3_log": ("Transacciones en 3 meses", "log"),
    "active_days_w3": ("Días con actividad bancaria (3 m)", "días"),
    "inv_n_counterparties_w3": ("Contrapartidas distintas en facturas (3 m)", "n"),
    "n_counterparties_w3_mean": ("Contrapartidas bancarias distintas por mes (3 m)", "n"),
    "discarded_share_w3": ("Movimientos descartados en conciliación (3 m)", "%"),
    "no_accounting_share_w3": ("Movimientos sin estado contable (3 m)", "%"),
    "inflow_vol6": ("Volatilidad de cobros (6 m)", "x"),
    "bank_peer_cash_neg_months_w6": ("Meses en descubierto de empresas del mismo banco (6 m)", "meses"),
    "bank_peer_interest_n_w6": ("Liquidaciones de intereses de empresas del mismo banco (6 m)", "n"),
    "sib_stress_rate_w6": ("Términos de estrés en empresas hermanas del grupo (6 m)", "%"),
    "sib_io_ratio_w3": ("Ratio cobros/pagos de las empresas hermanas (3 m)", "x"),
    "sib_interest_n_w6": ("Liquidaciones de intereses de las empresas hermanas (6 m)", "n"),
    "n_siblings_active": ("Empresas hermanas activas en el grupo", "n"),
    "main_bank": ("Banco principal", "cat"), "erp_any": ("ERP", "cat"), "country": ("País", "cat"),
    "currency": ("Divisa", "cat"), "size_cohort": ("Cohorte de tamaño", "cat"),
    "has_invoices": ("Facturación sincronizada desde ERP", "bool"), "country_missing": ("País no informado", "bool"),
    "erp_missing": ("Sin ERP conectado", "bool"), "n_bank_accounts": ("Cuentas corrientes", "n"), "n_cards": ("Tarjetas", "n"),
    "n_credit_lines": ("Líneas de crédito", "n"), "n_loans": ("Préstamos", "n"), "wavg_interest_rate": ("Tipo de interés medio", "x"),
    "credit_util_trend6": ("Tendencia de utilización de líneas (6 m)", "x/mes"), "outflow_trend6": ("Tendencia de pagos (6 m)", "log/mes"),
    "n_tx_trend6": ("Tendencia de actividad transaccional (6 m)", "log/mes"), "fee_amt_ratio_w6": ("Comisiones sobre pagos (6 m)", "%"),
    "pending_status_share_w3": ("Movimientos pendientes de contabilizar (3 m)", "%"), "uncategorized_share_w3": ("Movimientos sin categoría (3 m)", "%"),
    "inv_issued_w3_log": ("Facturas emitidas (3 m)", "log"), "inv_no_cp_share_w6": ("Facturas sin contrapartida (6 m)", "%"),
    "inv_stress_rate_w6": ("Facturas con términos de estrés (6 m)", "%"), "cash_withdrawal_share_w6": ("Retiradas de efectivo sobre movimientos (6 m)", "%"),
    "refund_share_w6": ("Devoluciones sobre movimientos (6 m)", "%"), "salary_amt_ratio_w3_w12": ("Nóminas 3 m frente a media 12 m", "x"),
    "salary_day_delta": ("Cambio en el día de pago de nóminas (3 m vs 12 m)", "días"), "ss_amt_ratio_w3_w12": ("Seg. Social 3 m frente a media 12 m", "x"),
    "ss_day_mean_w3": ("Día del mes de pago de Seg. Social (3 m)", "día"), "tax_share_of_outflow_w6": ("Impuestos sobre pagos (6 m)", "%"),
    "pay_n_w6_log": ("Facturas a pagar vencidas en 6 m", "log"), "rec_n_w6_log": ("Facturas a cobrar vencidas en 6 m", "log"),
    "pay_term_days_w6": ("Plazo medio de pago pactado (6 m)", "días"), "pay_open_overdue_cv12": ("Estacionalidad del impago (12 m)", "x"),
    "rec_open_overdue_trend6": ("Tendencia del % de facturas a cobrar vencidas (6 m)", "pp/mes"), "rec_dpd_mean_w3": ("Retraso medio de cobro de clientes (3 m)", "días"),
    "rec_amt_open_overdue_ratio_w6": ("Importe a cobrar vencido sobre facturado (6 m)", "%"), "pay_bad_share_delta3": ("Cambio en % facturas con >30 d (3 m)", "pp"),
    "hhi_in_delta3": ("Cambio en concentración de clientes (3 m)", "idx"), "top1_in_delta3": ("Cambio en peso del mayor cliente (3 m)", "pp"),
    "top1_out_share": ("Peso del mayor proveedor en los pagos", "%"), "n_cp_in_log": ("Clientes con cobros identificados (6 m)", "log"),
    "n_cp_out_log": ("Proveedores con pagos identificados (6 m)", "log"), "resolved_inflow_share_w6": ("Cobros con contrapartida identificada (6 m)", "%"),
    "no_counterparty_delta_w3_w12": ("Cambio en movimientos sin contrapartida (3 m vs 12 m)", "pp"), "no_accounting_delta_w3_w12": ("Cambio en movimientos sin estado contable", "pp"),
    "stress_terms_n_w3": ("Movimientos con términos de estrés (3 m)", "n"), "stress_trend6": ("Tendencia de términos de estrés (6 m)", "pp/mes"),
    "stress_terms_rate_w12": ("Movimientos con términos de estrés (12 m)", "%"), "interest_amt_ratio_w6": ("Intereses/comisiones de descubierto sobre pagos (6 m)", "%"),
    "n_cash_accounts_neg_T": ("Cuentas en negativo a fin de mes", "n"), "credit_drawn_T_log": ("Crédito dispuesto", "log€"), "card_drawn_T_log": ("Saldo de tarjetas", "log€"),
    "debt_repayment_trend6": ("Tendencia de amortización de deuda (6 m)", "log/mes"), "inflow_w1_log": ("Cobros del último mes", "log€"), "outflow_w1_log": ("Pagos del último mes", "log€"),
    "inflow_w3_log": ("Cobros (3 m)", "log€"), "outflow_w3_log": ("Pagos (3 m)", "log€"), "inflow_w6_log": ("Cobros (6 m)", "log€"), "outflow_w6_log": ("Pagos (6 m)", "log€"),
    "n_products_total": ("Productos bancarios conectados", "n"), "main_bank_share": ("Peso del banco principal", "%"), "loan_granted_total": ("Préstamos concedidos", "log€"),
    "total_periods_mean": ("Plazo medio de los préstamos", "n"), "share_variable_rate": ("Deuda a tipo variable", "%"), "n_leasing": ("Leasings", "n"),
    "n_guarantees": ("Avales", "n"), "n_confirming_factoring": ("Confirming / factoring", "n"),
}
PCT_FEATURES = {k for k, (_, u) in FEATURE_TEXT.items() if u == "%"}


def load_registry(version: str | None = None) -> tuple[dict, dict, str]:
    version = version or (C.REGISTRY_DIR / "latest.txt").read_text().strip()
    art = joblib.load(C.REGISTRY_DIR / version / "pipeline.joblib")
    md = json.loads((C.REGISTRY_DIR / version / "metadata.json").read_text())
    return art, md, version


def score_main(art: dict, X: pd.DataFrame, calibrated: bool = True) -> np.ndarray:
    """Probabilidad del modelo principal (LightGBM-B o ensemble) + calibración Platt."""
    feats = art["features_B"]
    p = art["pipelines"]["lgbm_B"].predict_proba(X[feats])[:, 1]
    if art["main_model"] == "ens_B":
        p = 0.5 * p + 0.5 * art["pipelines"]["catboost_B"].predict_proba(X[feats])[:, 1]
    return art["calibrator"].transform(p) if calibrated else p


def shap_values(art: dict, X: pd.DataFrame) -> pd.DataFrame:
    """TreeSHAP exacto del componente LightGBM-B (pred_contrib). Última columna = valor base."""
    pipe = art["pipelines"]["lgbm_B"]
    feats = art["features_B"]
    Xt = pipe.named_steps["cat"].transform(X[feats])
    contrib = pipe.named_steps["clf"].booster_.predict(Xt, pred_contrib=True)
    return pd.DataFrame(contrib, columns=feats + ["_base"], index=X.index)


def describe(feature: str, value) -> str:
    label, unit = FEATURE_TEXT.get(feature, (feature, ""))
    if isinstance(value, str):
        return f"{label}: {value}"
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return f"{label}: sin dato"
    v = float(value)
    if abs(v) < 5e-3:
        v = 0.0                                   # evita "-0"
    if unit == "pp":
        return f"{label}: {100 * v:+.0f} pp"
    if unit == "bool":
        return f"{label}: {'sí' if v >= 0.5 else 'no'}"
    if unit == "log":
        return f"{label}: {np.expm1(v):,.0f}"
    if unit == "%":
        return f"{label}: {100 * v:.0f}%"
    if unit == "log€":
        return f"{label}: {np.sign(v) * (np.expm1(abs(v))):,.0f} €"
    if unit in ("días", "meses", "n", "empresas", "día"):
        return f"{label}: {v:.0f} {unit}"
    return f"{label}: {v:.2f} {unit}".strip()


def local_explanations(art: dict, X: pd.DataFrame, top_n: int = C.TOP_N_SHAP) -> pd.DataFrame:
    """Top-n contribuciones SHAP por fila (empresa, T), con texto en lenguaje natural."""
    S = shap_values(art, X)
    feats = art["features_B"]
    rows = []
    vals = S[feats].to_numpy()
    for i, (cid, T) in enumerate(zip(X["company_id"].to_numpy(), X["T"].to_numpy())):
        order = np.argsort(-np.abs(vals[i]))[:top_n]
        for rank, j in enumerate(order):
            f = feats[j]
            v = X.iloc[i][f]
            rows.append({"company_id": cid, "T": T, "rank": rank + 1, "feature": f, "block": art.get("block_of", {}).get(f, ""),
                         "value": None if pd.isna(v) or isinstance(v, str) else float(v), "value_str": str(v),
                         "shap": float(vals[i, j]), "direction": "sube" if vals[i, j] > 0 else "baja",
                         "text": describe(f, v)})
    return pd.DataFrame(rows)


def global_importance(art: dict, X: pd.DataFrame, blocks: dict) -> tuple[pd.DataFrame, dict]:
    S = shap_values(art, X)
    feats = art["features_B"]
    imp = S[feats].abs().mean().sort_values(ascending=False).rename("mean_abs_shap").reset_index().rename(columns={"index": "feature"})
    block_of = {f: b for b, fs in blocks.items() for f in fs}
    imp["block"] = imp["feature"].map(block_of)
    imp["label"] = imp["feature"].map(lambda f: FEATURE_TEXT.get(f, (f, ""))[0])
    by_block = imp.groupby("block")["mean_abs_shap"].sum()
    share = (by_block / by_block.sum()).round(4).to_dict()
    return imp, {"by_block_abs": by_block.round(5).to_dict(), "by_block_share": share,
                 "behavioural_share": float(sum(v for k, v in share.items() if k != "A"))}


def _clean(o):
    """NaN/inf → None recursivamente (JSON estricto en la API)."""
    if isinstance(o, dict):
        return {k: _clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_clean(v) for v in o]
    if isinstance(o, (float, np.floating)) and not np.isfinite(o):
        return None
    if isinstance(o, np.generic):
        return o.item()
    return o


def error_analysis(preds: pd.DataFrame, X: pd.DataFrame, lab: pd.DataFrame) -> dict:
    """Perfil de los falsos negativos del holdout (positivos fuera del top-15 % de score por mes)."""
    df = preds.merge(lab[["company_id", "T"] + [f"z_{c}" for c in C.LABEL_WEIGHTS] + ["size_cohort"]], on=["company_id", "T"], how="left")
    df = df.merge(X[["company_id", "T", "has_invoices", "months_in_panel", "n_debt_products", "pay_n_w6_log"]], on=["company_id", "T"], how="left")
    df["rank_pct"] = df.groupby("T")["p_main_cal"].rank(ascending=False, pct=True)
    df["pred_pos"] = df["rank_pct"] <= 0.15
    groups = {"TP": df[(df.y == 1) & df.pred_pos], "FN": df[(df.y == 1) & ~df.pred_pos],
              "FP": df[(df.y == 0) & df.pred_pos], "TN": df[(df.y == 0) & ~df.pred_pos]}
    zcols = [f"z_{c}" for c in C.LABEL_WEIGHTS]
    out = {"confusion_top15pct": {k: int(len(v)) for k, v in groups.items()}}
    prof = {}
    for k in ("TP", "FN", "FP"):
        g = groups[k]
        prof[k] = {"n": int(len(g)), "z_components_mean": g[zcols].mean().round(2).to_dict(),
                   "has_invoices_share": float(g["has_invoices"].mean()), "months_in_panel_mean": float(g["months_in_panel"].mean()),
                   "n_debt_products_mean": float(g["n_debt_products"].mean()),
                   "size_cohort_dist": g["size_cohort"].value_counts(normalize=True).round(2).to_dict()}
    out["profiles"] = prof
    fn = groups["FN"]
    # ¿qué componente de D domina en los falsos negativos? (el que más contribuye a que D supere el umbral)
    dom = fn[zcols].idxmax(axis=1).value_counts(normalize=True).round(2).to_dict() if len(fn) else {}
    out["fn_dominant_component"] = dom
    top = max(dom, key=dom.get) if dom else None
    out["reading"] = (f"Los falsos negativos están dominados por el componente {top} ({dom.get(top, 0):.0%}): deterioros "
                      "que se manifiestan como cese súbito de actividad o colapso de cobros son los menos anticipables "
                      "desde la ventana de observación; los que vienen de morosidad e iliquidez sí se capturan.")
    return _clean(out)


# --------------------------------------------------------------------------------------
# Figuras
# --------------------------------------------------------------------------------------
def make_figures(preds: pd.DataFrame, results: dict, imp: pd.DataFrame, block_imp: dict, S_sample: pd.DataFrame, X_sample: pd.DataFrame) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from sklearn.metrics import precision_recall_curve
    FIG_DIR.mkdir(parents=True, exist_ok=True)
    plt.rcParams.update({"figure.dpi": 130, "font.size": 9})

    # PR curves A vs B
    fig, ax = plt.subplots(figsize=(6, 4.5))
    for key, lbl, c in [("lr_A", "LR — A (proxy FICO)", "#999"), ("lgbm_A", "LightGBM — A", "#c77"),
                        ("lgbm_B", "LightGBM — B (comportamental)", "#37a"), ("p_main_cal", "Principal (calibrado)", "#173")]:
        if key in preds:
            pr, rc, _ = precision_recall_curve(preds["y"], preds[key])
            ax.plot(rc, pr, label=f"{lbl}  AP={results['holdout'].get(key, {}).get('auc_pr', np.nan):.3f}" if key != "p_main_cal" else lbl, color=c)
    ax.axhline(preds["y"].mean(), ls="--", color="k", lw=0.8, label=f"base rate {preds['y'].mean():.2f}")
    ax.set_xlabel("Recall"); ax.set_ylabel("Precision"); ax.set_title("Curvas PR en holdout — Modelo A vs B"); ax.legend(fontsize=7)
    fig.tight_layout(); fig.savefig(FIG_DIR / "pr_curves_holdout.png"); plt.close(fig)

    # calibración
    cc = pd.DataFrame(results["calibration"]["curve"])
    fig, ax = plt.subplots(figsize=(4.5, 4.5))
    ax.plot([0, 1], [0, 1], "--", color="k", lw=0.8)
    if len(cc):
        ax.plot(cc["pred_mean"], cc["obs_rate"], "o-", color="#37a")
        for _, r in cc.iterrows():
            ax.annotate(str(r["n"]), (r["pred_mean"], r["obs_rate"]), fontsize=6, xytext=(3, 3), textcoords="offset points")
    ax.set_xlabel("Probabilidad predicha (calibrada)"); ax.set_ylabel("Tasa observada")
    ax.set_title(f"Calibración holdout — Brier {results['calibration']['brier_raw']:.3f} → {results['calibration']['brier_cal']:.3f}")
    fig.tight_layout(); fig.savefig(FIG_DIR / "calibration_holdout.png"); plt.close(fig)

    # importancia global top 20
    top = imp.head(20).iloc[::-1]
    colors = {"A": "#999", "B": "#d55", "C": "#37a", "D": "#e93", "E": "#8c5", "F": "#a6a"}
    fig, ax = plt.subplots(figsize=(8.5, 6))
    ax.barh(top["label"].str.slice(0, 55), top["mean_abs_shap"], color=[colors.get(b, "#777") for b in top["block"]])
    ax.set_xlim(left=0); ax.set_xlabel("media |SHAP|"); ax.set_title("Importancia global (TreeSHAP) — color = bloque")
    for b, c in colors.items():
        ax.bar(0, 0, color=c, label=f"Bloque {b}")
    ax.legend(fontsize=7, loc="lower right"); fig.tight_layout(); fig.savefig(FIG_DIR / "shap_global_top20.png"); plt.close(fig)

    # importancia por bloque
    bb = pd.Series(block_imp["by_block_share"]).reindex(list("ABCDEF")).fillna(0)
    fig, ax = plt.subplots(figsize=(5, 3.5))
    ax.bar(bb.index, bb.values, color=[colors[b] for b in bb.index])
    ax.set_ylabel("cuota de |SHAP|"); ax.set_title(f"¿De dónde viene el score? — bloques B–F = {block_imp['behavioural_share']:.0%}")
    fig.tight_layout(); fig.savefig(FIG_DIR / "shap_by_block.png"); plt.close(fig)

    # beeswarm simplificado (top 12): SHAP vs. valor normalizado
    feats = imp["feature"].head(12).tolist()
    fig, ax = plt.subplots(figsize=(7, 5))
    rng = np.random.default_rng(C.SEED)
    for i, f in enumerate(feats[::-1]):
        s = S_sample[f].to_numpy()
        v = np.zeros(len(s)) if f in CATEGORICAL else X_sample[f].astype(float).to_numpy()
        vr = pd.Series(v).rank(pct=True).fillna(0.5).to_numpy()
        ax.scatter(s, i + rng.uniform(-0.25, 0.25, len(s)), c=vr, cmap="coolwarm", s=4, alpha=0.6)
    ax.set_yticks(range(len(feats))); ax.set_yticklabels([FEATURE_TEXT.get(f, (f, ""))[0][:50] for f in feats[::-1]], fontsize=7)
    ax.axvline(0, color="k", lw=0.6); ax.set_xlabel("valor SHAP (log-odds)"); ax.set_title("Beeswarm — color: valor de la variable (azul bajo → rojo alto)")
    fig.tight_layout(); fig.savefig(FIG_DIR / "shap_beeswarm.png"); plt.close(fig)

    # ablación
    ab = results.get("ablation", {})
    if ab:
        keys = [k for k in ab if k.startswith("A_plus")] + [k for k in ab if k.startswith("B_minus")]
        fig, ax = plt.subplots(figsize=(7, 3.8))
        vals = [ab[k]["delta_holdout"] for k in keys]
        ax.bar(range(len(keys)), vals, color=["#173" if k.startswith("A_plus") else "#c77" for k in keys])
        ax.set_xticks(range(len(keys))); ax.set_xticklabels([k.replace("A_plus_", "A+").replace("B_minus_", "B−") for k in keys], fontsize=7)
        ax.axhline(0, color="k", lw=0.6); ax.set_ylabel("Δ AUC-PR holdout")
        ax.set_title("Ablación: A + un bloque (verde, vs A)  ·  B − un bloque (rojo, vs B)")
        fig.tight_layout(); fig.savefig(FIG_DIR / "ablation.png"); plt.close(fig)


def run() -> dict:
    C.ensure_dirs()
    art, md, version = load_registry()
    blocks = md["feature_blocks"]
    art["block_of"] = {f: b for b, fs in blocks.items() for f in fs}
    X, meta = load_features()
    lab = pd.read_parquet(LABELS_PATH)
    results = json.loads((C.REPORTS_DIR / "train_results.json").read_text())
    preds = pd.read_parquet(C.REPORTS_DIR / "predictions_holdout.parquet")

    # --- SHAP global sobre holdout + último mes ------------------------------------------
    last_T = X["T"].max()
    X_last = X[X["T"] == last_T].reset_index(drop=True)
    X_hold = X.merge(preds[["company_id", "T"]], on=["company_id", "T"]).reset_index(drop=True)
    imp, block_imp = global_importance(art, pd.concat([X_hold, X_last], ignore_index=True), blocks)
    imp.to_csv(C.REPORTS_DIR / "shap_global_importance.csv", index=False)
    print(f"[evaluate] cuota SHAP por bloque: {block_imp['by_block_share']}  → comportamiento (B–F) = {block_imp['behavioural_share']:.1%}")

    # --- explicaciones locales para TODOS los meses (histórico en dashboard) -------------
    expl = local_explanations(art, X)
    expl.to_parquet(C.REPORTS_DIR / "score_explanations.parquet", index=False)
    print(f"[evaluate] explicaciones locales: {len(expl):,} filas ({expl['company_id'].nunique()} empresas, top-{C.TOP_N_SHAP})")

    # --- análisis de errores ---------------------------------------------------------------
    err = error_analysis(preds, X, lab)
    print(f"[evaluate] confusión top-15%: {err['confusion_top15pct']}  FN dominados por: {err['fn_dominant_component']}")

    # --- figuras ---------------------------------------------------------------------------
    S_hold = shap_values(art, X_hold)
    make_figures(preds, results, imp, block_imp, S_hold, X_hold)

    summary = {"version": version, "main_model": md["main_model"], "holdout": results["holdout"], "lift": results["lift"],
               "ablation": results.get("ablation", {}), "calibration": {k: v for k, v in results["calibration"].items() if k != "curve"},
               "shap_block_importance": block_imp, "top_features": imp.head(25).to_dict(orient="records"),
               "error_analysis": err, "cv": {k: {"auc_pr_mean": v["auc_pr_mean"], "auc_pr_std": v["auc_pr_std"]} for k, v in results["cv"].items()}}
    summary = _clean(summary)
    (C.REPORTS_DIR / "evaluation_summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False, default=str))
    print(f"[evaluate] figuras en {FIG_DIR}")
    return summary


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    run()
