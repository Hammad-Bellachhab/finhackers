"""Capa 4 — Ingeniería de features: panel empresa × mes (≈ 30 k filas × ~130 columnas).

Bloques (Figura 4 del documento):
    A  Estructurales ("proxy FICO", lo que ve un banco)      → Modelo A
    B  Comportamiento de pago (DPD, prelación, tendencia)
    C  Dinámica de liquidez (cobros/pagos, caja reconstruida, descubierto)
    D  Concentración de contrapartidas (HHI, churn)
    E  Red / grupo / banco (agregación jerárquica, sin GNN)
    F  Texto y calidad del dato (términos de estrés, missingness y su tendencia)

Regla dura: toda feature de la fila (empresa, T) usa exclusivamente datos con fecha <= fin de T.
Para cada magnitud se incluye nivel (ventanas 1/3/6/12) y tendencia (pendiente sobre 6 meses).
"""
from __future__ import annotations

import json
import sys
import warnings

import numpy as np
import pandas as pd

from src import config as C
from src.schema import load_cm

FEATURES_PATH = C.PARQUET_DIR / "features.parquet"
FEATURES_META_PATH = C.PARQUET_DIR / "features_meta.json"

CATEGORICAL = ["country", "currency", "erp_any", "main_bank", "size_cohort"]
ID_COLS = ["company_id", "T", "t_idx", "group_id"]


# --------------------------------------------------------------------------------------
# Utilidades sobre matrices empresa × mes
# --------------------------------------------------------------------------------------
def pivot(df: pd.DataFrame, col: str, months, companies, fill=np.nan) -> pd.DataFrame:
    p = df.pivot(index="company_id", columns="T", values=col).reindex(index=companies, columns=months).astype(float)
    return p if fill is np.nan else p.fillna(fill)


def roll(M: pd.DataFrame, k: int, how: str = "sum", min_periods: int = 1) -> pd.DataFrame:
    """Ventana móvil de k meses (incluido el actual) a lo largo de las columnas."""
    r = M.T.rolling(k, min_periods=min_periods)
    return getattr(r, how)().T


def lag(M: pd.DataFrame, k: int) -> pd.DataFrame:
    return M.shift(k, axis=1)


def roll_slope(M: pd.DataFrame, k: int, min_points: int = 3) -> pd.DataFrame:
    """Pendiente OLS de los últimos k valores (NaN-aware), vectorizada por columna."""
    V = M.to_numpy(dtype=float)
    n_rows, n_cols = V.shape
    out = np.full_like(V, np.nan)
    x_full = np.arange(k, dtype=float)
    for t in range(n_cols):
        lo = max(0, t - k + 1)
        sub = V[:, lo:t + 1]
        x = x_full[k - sub.shape[1]:]
        mask = ~np.isnan(sub)
        n = mask.sum(axis=1)
        xm = np.where(mask, x, 0).sum(axis=1) / np.maximum(n, 1)
        ym = np.where(mask, sub, 0).sum(axis=1) / np.maximum(n, 1)
        dx = np.where(mask, x - xm[:, None], 0)
        dy = np.where(mask, sub - ym[:, None], 0)
        sxx = (dx * dx).sum(axis=1)
        sxy = (dx * dy).sum(axis=1)
        s = np.where((n >= min_points) & (sxx > 0), sxy / np.where(sxx > 0, sxx, 1), np.nan)
        out[:, t] = s
    return pd.DataFrame(out, index=M.index, columns=M.columns)


def safe_div(a, b):
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    with np.errstate(divide="ignore", invalid="ignore"):
        return np.where(np.abs(b) > 1e-9, a / np.where(np.abs(b) > 1e-9, b, 1), np.nan)


def sdiv(A: pd.DataFrame, B: pd.DataFrame) -> pd.DataFrame:
    return pd.DataFrame(safe_div(A.to_numpy(), B.to_numpy()), index=A.index, columns=A.columns)


def slog(M: pd.DataFrame) -> pd.DataFrame:
    """log signado: sign(x)·log1p(|x|)."""
    return np.sign(M) * np.log1p(M.abs())


# --------------------------------------------------------------------------------------
# Construcción
# --------------------------------------------------------------------------------------
def build_features(save: bool = True) -> tuple[pd.DataFrame, dict]:
    warnings.filterwarnings("ignore", category=RuntimeWarning)
    warnings.filterwarnings("ignore", category=pd.errors.PerformanceWarning)
    months = C.month_range()
    t_idx = {m: i for i, m in enumerate(months)}
    tx = load_cm("cm_tx")
    cash = load_cm("cm_cash")
    inv_lag = load_cm("cm_invoice_lag")
    inv_iss = load_cm("cm_invoice_issued")
    conc = load_cm("cm_concentration")
    dim_company = load_cm("dim_company")
    dim_product = load_cm("dim_product")
    sched = load_cm("dim_debt_schedule")
    companies = pd.Index(sorted(dim_company["company_id"]))
    F: dict[str, pd.DataFrame] = {}      # nombre → matriz empresa × mes
    blocks: dict[str, list[str]] = {b: [] for b in "ABCDEF"}

    def add(block: str, name: str, M: pd.DataFrame):
        F[name] = M
        blocks[block].append(name)

    # ---------------------------------------------------------------- base transaccional
    P = lambda col, fill=np.nan: pivot(tx, col, months, companies, fill)
    n_tx = P("n_tx", 0.0)
    inflow = P("inflow_oper", 0.0)
    outflow = P("outflow_oper", 0.0)
    inflow_tot = P("inflow_total", 0.0)
    first_active = pd.Series(np.argmax(n_tx.values > 0, axis=1), index=companies)
    ever_active = n_tx.values.sum(axis=1) > 0
    months_in_panel = pd.DataFrame(np.arange(len(months))[None, :] - first_active.values[:, None] + 1,
                                   index=companies, columns=months).astype(float)
    in_panel = months_in_panel >= 1
    in_panel.loc[~ever_active] = False

    # ================================================================== BLOQUE A
    dc = dim_company.set_index("company_id").reindex(companies)
    T_end = pd.to_datetime(pd.Series(months) + "-01") + pd.offsets.MonthEnd(0)
    tenure = pd.DataFrame(
        (T_end.values[None, :] - dc["created_at"].values[:, None]) / np.timedelta64(30, "D"),
        index=companies, columns=months).astype(float)
    add("A", "tenure_months", tenure)
    add("A", "months_in_panel", months_in_panel)
    add("A", "group_size", pd.DataFrame(np.repeat(dc["group_size"].values[:, None].astype(float), len(months), 1), index=companies, columns=months))
    prod = dim_product
    bank_prod = prod[~prod["is_debt"]]
    debt = prod[prod["is_debt"]]
    static = pd.DataFrame(index=companies)
    static["n_bank_accounts"] = bank_prod[bank_prod["type"] == "checking"].groupby("company_id").size()
    static["n_cards"] = bank_prod[bank_prod["type"] == "card"].groupby("company_id").size()
    static["n_products_total"] = prod.groupby("company_id").size()
    real_banks = prod[~prod["bank_name"].fillna("Other").str.startswith("Other")]
    static["n_banks"] = real_banks.groupby("company_id")["bank_name"].nunique()
    main_bank = (real_banks.groupby(["company_id", "bank_name"]).size().rename("n").reset_index()
                 .sort_values(["company_id", "n"], ascending=[True, False]).drop_duplicates("company_id").set_index("company_id"))
    static["main_bank_share"] = main_bank["n"] / static["n_products_total"]
    static["n_debt_products"] = debt.groupby("company_id").size()
    for typ, nm in [("loan", "n_loans"), ("lineofcredit", "n_credit_lines"), ("leasing", "n_leasing"), ("guarantee", "n_guarantees")]:
        static[nm] = debt[debt["type"] == typ].groupby("company_id").size()
    static["n_confirming_factoring"] = debt[debt["type"].isin(["confirming", "factoring"])].groupby("company_id").size()
    static["debt_granted_total"] = debt.groupby("company_id")["granted"].apply(lambda s: s.abs().sum())
    static["loan_granted_total"] = debt[debt["type"].isin(["loan", "mortgage", "leasing"])].groupby("company_id")["granted"].apply(lambda s: s.abs().sum())
    sc = sched.copy()
    sc["w"] = sc["granted_balance"].abs().fillna(0) + 1
    if len(sc):
        static["wavg_interest_rate"] = sc.groupby("company_id").apply(lambda d: np.average(d["annual_interest_rate_or_spread"].fillna(0), weights=d["w"]), include_groups=False)
        static["total_periods_mean"] = sc.groupby("company_id")["total_periods"].mean()
        static["share_variable_rate"] = sc.groupby("company_id")["interest_type"].apply(lambda s: (s == "variable").mean())
    else:                                           # test sin calendarios de préstamo (p. ej. test oculto pequeño)
        static["wavg_interest_rate"] = static["total_periods_mean"] = static["share_variable_rate"] = np.nan
    for col in ["n_bank_accounts", "n_cards", "n_products_total", "n_banks", "n_debt_products", "n_loans",
                "n_credit_lines", "n_leasing", "n_guarantees", "n_confirming_factoring", "debt_granted_total", "loan_granted_total"]:
        static[col] = static[col].fillna(0)
    for col in static.columns:
        M = pd.DataFrame(np.repeat(static[col].values[:, None].astype(float), len(months), 1), index=companies, columns=months)
        if col.endswith("_total"):
            M = np.log1p(M)
        add("A", col, M)
    # nivel en T (reconstruido)
    cash_bal = pivot(cash, "cash_balance", months, companies)
    credit_drawn = pivot(cash, "credit_drawn", months, companies)
    credit_granted = pivot(cash, "credit_granted", months, companies)
    card_drawn = pivot(cash, "card_drawn", months, companies)
    n_cash_neg = pivot(cash, "n_cash_accounts_neg", months, companies)
    out_avg6 = roll(outflow, 6, "mean")
    add("A", "cash_balance_T_log", slog(cash_bal))
    add("A", "cash_months_of_outflow", sdiv(cash_bal, out_avg6).clip(-24, 24))
    add("A", "credit_util_T", sdiv(credit_drawn, credit_granted).clip(0, 2))
    add("A", "credit_drawn_T_log", np.log1p(credit_drawn.clip(lower=0)))
    add("A", "card_drawn_T_log", np.log1p(card_drawn.clip(lower=0)))
    debt_rep = P("amt_debt_repayment", 0.0)
    add("A", "debt_service_ratio_w6", sdiv(roll(debt_rep, 6), roll(inflow, 6)).clip(0, 5))
    add("A", "turnover_out_w12_log", np.log1p(roll(outflow, 12)))
    add("A", "turnover_in_w12_log", np.log1p(roll(inflow, 12)))

    # ================================================================== BLOQUE B
    # facturas observadas en T, agregadas por ventana de vencimiento (ponderando por n)
    def inv_window(is_payable: bool, k: int) -> pd.DataFrame:
        d = inv_lag[(inv_lag["is_payable"] == is_payable) & (inv_lag["lag"] < k)].copy()
        for c in ["dpd_mean", "dpd_p90", "bad_share", "open_overdue_share", "term_days_mean"]:
            d[c] = d[c] * d["n"]
        g = d.groupby(["company_id", "T"]).agg(n=("n", "sum"), amt=("amt", "sum"), dpd_mean=("dpd_mean", "sum"),
                                                 dpd_p90=("dpd_p90", "sum"), bad_share=("bad_share", "sum"),
                                                 open_overdue_share=("open_overdue_share", "sum"),
                                                 amt_open_overdue=("amt_open_overdue", "sum"), amt_open=("amt_open", "sum"),
                                                 max_open_dpd=("max_open_dpd", "max"), term_days_mean=("term_days_mean", "sum")).reset_index()
        for c in ["dpd_mean", "dpd_p90", "bad_share", "open_overdue_share", "term_days_mean"]:
            g[c] = g[c] / g["n"]
        g["amt_open_overdue_ratio"] = safe_div(g["amt_open_overdue"], g["amt"])
        g["amt_open_ratio"] = safe_div(g["amt_open"], g["amt"])
        return g

    pay = {k: inv_window(True, k) for k in (3, 6, 12)}
    rec = {k: inv_window(False, k) for k in (3, 6, 12)}
    PI = lambda g, col: pivot(g, col, months, companies)
    for k in (3, 6, 12):
        add("B", f"pay_dpd_mean_w{k}", PI(pay[k], "dpd_mean"))
        add("B", f"pay_bad_share_w{k}", PI(pay[k], "bad_share"))
        add("B", f"pay_open_overdue_share_w{k}", PI(pay[k], "open_overdue_share"))
    add("B", "pay_dpd_p90_w6", PI(pay[6], "dpd_p90"))
    add("B", "pay_amt_open_overdue_ratio_w6", PI(pay[6], "amt_open_overdue_ratio"))
    add("B", "pay_amt_open_overdue_ratio_w12", PI(pay[12], "amt_open_overdue_ratio"))
    add("B", "pay_max_open_dpd_w12", PI(pay[12], "max_open_dpd").clip(upper=400))
    add("B", "pay_n_w6_log", np.log1p(PI(pay[6], "n").fillna(0)))
    add("B", "pay_term_days_w6", PI(pay[6], "term_days_mean"))
    # tendencias: serie temporal de la métrica w3 observada en cada T
    add("B", "pay_open_overdue_trend6", roll_slope(F["pay_open_overdue_share_w3"], 6))
    add("B", "pay_dpd_trend6", roll_slope(F["pay_dpd_mean_w3"], 6))
    add("B", "pay_bad_share_delta3", F["pay_bad_share_w3"] - lag(F["pay_bad_share_w3"], 3))
    add("B", "pay_open_overdue_cv12", sdiv(roll(F["pay_open_overdue_share_w3"], 12, "std"), roll(F["pay_open_overdue_share_w3"], 12, "mean") + 0.05))
    # a cobrar: los clientes pagan tarde
    add("B", "rec_dpd_mean_w3", PI(rec[3], "dpd_mean"))
    add("B", "rec_dpd_mean_w6", PI(rec[6], "dpd_mean"))
    add("B", "rec_bad_share_w6", PI(rec[6], "bad_share"))
    add("B", "rec_open_overdue_share_w3", PI(rec[3], "open_overdue_share"))
    add("B", "rec_open_overdue_share_w6", PI(rec[6], "open_overdue_share"))
    add("B", "rec_amt_open_overdue_ratio_w6", PI(rec[6], "amt_open_overdue_ratio"))
    add("B", "rec_open_overdue_trend6", roll_slope(F["rec_open_overdue_share_w3"], 6))
    add("B", "rec_n_w6_log", np.log1p(PI(rec[6], "n").fillna(0)))
    # orden de prelación: nóminas, seguridad social, impuestos
    n_sal, n_ss, n_tax = P("n_salary", 0.0), P("n_social_security", 0.0), P("n_tax", 0.0)
    amt_sal, amt_tax, amt_ss = P("amt_salary", 0.0), P("amt_tax", 0.0), P("amt_social_security", 0.0)
    sal_day, ss_day = P("salary_day_mean"), P("ss_day_mean")
    ever_sal12 = roll(n_sal, 12) > 0
    add("B", "salary_months_share_w6", roll((n_sal > 0).astype(float), 6, "mean").where(ever_sal12))
    add("B", "salary_day_mean_w3", roll(sal_day, 3, "mean"))
    add("B", "salary_day_delta", roll(sal_day, 3, "mean") - roll(sal_day, 12, "mean"))
    add("B", "salary_amt_ratio_w3_w12", sdiv(roll(amt_sal, 3, "mean"), roll(amt_sal, 12, "mean")).clip(0, 5))
    ever_ss12 = roll(n_ss, 12) > 0
    add("B", "ss_months_share_w6", roll((n_ss > 0).astype(float), 6, "mean").where(ever_ss12))
    add("B", "ss_day_mean_w3", roll(ss_day, 3, "mean"))
    add("B", "ss_amt_ratio_w3_w12", sdiv(roll(amt_ss, 3, "mean"), roll(amt_ss, 12, "mean")).clip(0, 5))
    ever_tax12 = roll(n_tax, 12) > 0
    add("B", "tax_months_share_w6", roll((n_tax > 0).astype(float), 6, "mean").where(ever_tax12))
    add("B", "tax_amt_ratio_w3_w12", sdiv(roll(amt_tax, 3, "mean"), roll(amt_tax, 12, "mean")).clip(0, 5))
    add("B", "tax_share_of_outflow_w6", sdiv(roll(amt_tax, 6), roll(outflow, 6)).clip(0, 1))

    # ================================================================== BLOQUE C
    for k in (1, 3, 6):
        add("C", f"inflow_w{k}_log", np.log1p(roll(inflow, k)))
        add("C", f"outflow_w{k}_log", np.log1p(roll(outflow, k)))
    for k in (1, 3, 6, 12):
        add("C", f"io_ratio_w{k}", sdiv(roll(inflow, k), roll(outflow, k)).clip(0, 5))
    io_m = sdiv(inflow, outflow).clip(0, 5)
    add("C", "io_ratio_trend6", roll_slope(io_m, 6))
    add("C", "net_flow_norm_w3", sdiv(roll(inflow, 3) - roll(outflow, 3), roll(outflow, 3)).clip(-5, 5))
    add("C", "inflow_trend6", roll_slope(np.log1p(inflow), 6))
    add("C", "outflow_trend6", roll_slope(np.log1p(outflow), 6))
    add("C", "inflow_w3_vs_w12", sdiv(roll(inflow, 3, "mean"), roll(inflow, 12, "mean")).clip(0, 5))
    add("C", "inflow_vol6", sdiv(roll(inflow, 6, "std"), roll(inflow, 6, "mean") + 1).clip(0, 5))
    cash_norm = sdiv(cash_bal, out_avg6 + 1)
    add("C", "cash_trend6", roll_slope(cash_norm, 6).clip(-10, 10))
    add("C", "cash_vol6", sdiv(roll(cash_bal, 6, "std"), roll(cash_bal, 6, "mean").abs() + out_avg6 + 1).clip(0, 10))
    for k in (3, 6, 12):
        add("C", f"cash_neg_months_w{k}", roll((cash_bal < 0).astype(float).where(cash_bal.notna()), k, "sum"))
    add("C", "cash_min_w6_norm", sdiv(roll(cash_bal, 6, "min"), out_avg6 + 1).clip(-24, 24))
    add("C", "n_cash_accounts_neg_T", n_cash_neg)
    add("C", "days_of_cash", sdiv(cash_bal, roll(outflow, 3) / 90 + 1).clip(-365, 365))
    n_int, amt_int = P("n_interest_charge", 0.0), P("amt_interest_charge", 0.0)
    for k in (3, 6, 12):
        add("C", f"interest_n_w{k}", roll(n_int, k))
    add("C", "interest_trend6", roll_slope(n_int, 6))
    add("C", "interest_amt_ratio_w6", sdiv(roll(amt_int, 6), roll(outflow, 6)).clip(0, 1))
    add("C", "fee_amt_ratio_w6", sdiv(roll(P("amt_fee", 0.0), 6), roll(outflow, 6)).clip(0, 1))
    add("C", "credit_util_trend6", roll_slope(F["credit_util_T"], 6))
    add("C", "credit_util_max_w6", roll(F["credit_util_T"], 6, "max"))
    add("C", "n_tx_w1", n_tx)
    add("C", "n_tx_w3_log", np.log1p(roll(n_tx, 3)))
    add("C", "n_tx_trend6", roll_slope(np.log1p(n_tx), 6))
    add("C", "n_tx_w3_vs_w12", sdiv(roll(n_tx, 3, "mean"), roll(n_tx, 12, "mean")).clip(0, 5))
    add("C", "active_days_w3", roll(P("n_active_days", 0.0), 3))
    add("C", "inactive_months_w6", roll((n_tx == 0).astype(float), 6, "sum").where(in_panel))
    add("C", "cash_withdrawal_share_w6", sdiv(roll(P("n_cash_withdrawal", 0.0), 6), roll(n_tx, 6)))
    add("C", "refund_share_w6", sdiv(roll(P("n_refund", 0.0), 6), roll(n_tx, 6)))
    add("C", "cash_conversion_days_w6", (PI(rec[6], "term_days_mean") + PI(rec[6], "dpd_mean")).clip(-60, 400))
    add("C", "debt_repayment_trend6", roll_slope(np.log1p(debt_rep), 6))

    # ================================================================== BLOQUE D
    CI = lambda col: pivot(conc, col, months, companies)
    add("D", "hhi_in", CI("hhi_in"))
    add("D", "hhi_out", CI("hhi_out"))
    add("D", "top1_in_share", CI("top1_in_share"))
    add("D", "top1_out_share", CI("top1_out_share"))
    add("D", "n_cp_in_log", np.log1p(CI("n_cp_in")))
    add("D", "n_cp_out_log", np.log1p(CI("n_cp_out")))
    add("D", "n_eff_clients", sdiv(pd.DataFrame(1.0, index=companies, columns=months), CI("hhi_in")).clip(0, 500))
    add("D", "cp_in_churn", CI("cp_in_churn"))
    add("D", "hhi_in_delta3", CI("hhi_in") - lag(CI("hhi_in"), 3))
    add("D", "top1_in_delta3", CI("top1_in_share") - lag(CI("top1_in_share"), 3))
    add("D", "resolved_inflow_share_w6", sdiv(CI("inflow_res"), roll(inflow_tot, 6)).clip(0, 1))
    add("D", "n_counterparties_w3_mean", roll(P("n_counterparties", 0.0), 3, "mean"))

    # ================================================================== BLOQUE F (antes que E: E agrega F)
    n_stress = P("n_stress_terms", 0.0)
    for k in (3, 6, 12):
        add("F", f"stress_terms_rate_w{k}", sdiv(roll(n_stress, k), roll(n_tx, k)))
    add("F", "stress_terms_n_w3", roll(n_stress, 3))
    add("F", "stress_trend6", roll_slope(sdiv(n_stress, n_tx), 6))
    for col, nm in [("n_no_counterparty", "no_counterparty"), ("n_no_accounting", "no_accounting"),
                    ("n_discarded", "discarded"), ("n_reconciled", "reconciled"), ("n_status_pending", "pending_status"),
                    ("n_uncategorized", "uncategorized")]:
        M = P(col, 0.0)
        add("F", f"{nm}_share_w3", sdiv(roll(M, 3), roll(n_tx, 3)))
        if nm in ("no_counterparty", "no_accounting", "reconciled"):
            add("F", f"{nm}_delta_w3_w12", sdiv(roll(M, 3), roll(n_tx, 3)) - sdiv(roll(M, 12), roll(n_tx, 12)))
    II = lambda col: pivot(inv_iss, col, months, companies, 0.0)
    n_iss = II("n_inv_issued")
    add("F", "inv_issued_w3_log", np.log1p(roll(n_iss, 3)))
    add("F", "inv_issued_ratio_w3_w12", sdiv(roll(n_iss, 3, "mean"), roll(n_iss, 12, "mean")).clip(0, 5))
    has_inv = (n_iss.cumsum(axis=1) > 0).astype(float)
    add("F", "has_invoices", has_inv)
    # meses desde la última factura emitida (cap 12); NaN si nunca hubo ERP
    last_iss = pd.DataFrame(np.where(n_iss.values > 0, np.arange(len(months))[None, :], np.nan), index=companies, columns=months).ffill(axis=1)
    msli = pd.DataFrame(np.arange(len(months))[None, :] - last_iss.values, index=companies, columns=months).clip(upper=12)
    add("F", "months_since_last_invoice", msli)
    add("F", "inv_stress_rate_w6", sdiv(roll(II("n_inv_stress_terms"), 6), roll(n_iss, 6)))
    add("F", "inv_no_cp_share_w6", sdiv(roll(II("n_inv_no_counterparty"), 6), roll(n_iss, 6)))
    add("F", "inv_n_counterparties_w3", roll(II("n_inv_counterparties"), 3, "mean"))
    add("F", "country_missing", pd.DataFrame(np.repeat(dc["country"].isna().values[:, None].astype(float), len(months), 1), index=companies, columns=months))
    add("F", "erp_missing", pd.DataFrame(np.repeat(dc["erp_any"].isna().values[:, None].astype(float), len(months), 1), index=companies, columns=months))

    # ================================================================== BLOQUE E
    def peer_mean(M: pd.DataFrame, key: pd.Series) -> pd.DataFrame:
        """Media de M entre las empresas con la misma clave, excluyendo la propia."""
        valid = M.notna() & in_panel
        Mv = M.where(valid, 0.0)
        s = Mv.groupby(key.values).transform("sum")
        n = valid.astype(float).groupby(key.values).transform("sum")
        return sdiv(s - Mv, n - valid.astype(float)).where(n - valid.astype(float) >= 1)

    gkey = dc["group_id"].fillna("NOGROUP")
    bkey = main_bank["bank_name"].reindex(companies).fillna("NOBANK")
    add("E", "n_siblings_active", in_panel.astype(float).groupby(gkey.values).transform("sum") - in_panel.astype(float))
    add("E", "sib_pay_open_overdue_w6", peer_mean(F["pay_open_overdue_share_w6"], gkey))
    add("E", "sib_cash_neg_months_w6", peer_mean(F["cash_neg_months_w6"], gkey))
    add("E", "sib_io_ratio_w3", peer_mean(F["io_ratio_w3"], gkey))
    add("E", "sib_stress_rate_w6", peer_mean(F["stress_terms_rate_w6"], gkey))
    add("E", "sib_interest_n_w6", peer_mean(F["interest_n_w6"], gkey))
    add("E", "bank_peer_pay_open_overdue_w6", peer_mean(F["pay_open_overdue_share_w6"], bkey))
    add("E", "bank_peer_cash_neg_months_w6", peer_mean(F["cash_neg_months_w6"], bkey))
    add("E", "bank_peer_interest_n_w6", peer_mean(F["interest_n_w6"], bkey))

    # ---------------------------------------------------------------- a formato largo
    long = pd.concat({k: v.stack(future_stack=True) for k, v in F.items()}, axis=1)
    long.index.names = ["company_id", "T"]
    long = long.reset_index().copy()
    long = long[long.apply(lambda r: in_panel.at[r["company_id"], r["T"]], axis=1)].reset_index(drop=True)
    long["t_idx"] = long["T"].map(t_idx)
    long["group_id"] = long["company_id"].map(dc["group_id"])
    long["country"] = long["company_id"].map(dc["country"]).fillna("UNK")
    long["currency"] = long["company_id"].map(dc["currency"]).fillna("UNK")
    long["erp_any"] = long["company_id"].map(dc["erp_any"]).fillna("NONE")
    long["main_bank"] = long["company_id"].map(bkey)
    # cohorte de tamaño (cuartil de salida operativa 12 m) — sirve para benchmarks y como categórica
    size = roll(outflow, 12, "mean").stack(future_stack=True)
    size.index.names = ["company_id", "T"]
    long = long.merge(size.rename("size_outflow_12m").reset_index(), on=["company_id", "T"], how="left")
    long["size_cohort"] = pd.qcut(long["size_outflow_12m"].rank(method="first"), 4, labels=["q1", "q2", "q3", "q4"]).astype(str)
    for c in CATEGORICAL:
        long[c] = long[c].astype(str)
    blocks["A"] += ["country", "currency", "erp_any"]
    blocks["E"] += ["main_bank"]
    numeric = [c for c in long.columns if c not in ID_COLS + CATEGORICAL + ["size_outflow_12m"]]
    long[numeric] = long[numeric].astype("float32").replace([np.inf, -np.inf], np.nan)

    meta = {"blocks": blocks, "categorical": CATEGORICAL, "id_cols": ID_COLS,
            "n_rows": int(len(long)), "n_features": int(sum(len(v) for v in blocks.values())),
            "block_sizes": {k: len(v) for k, v in blocks.items()}}
    if save:
        long.to_parquet(FEATURES_PATH, index=False)
        FEATURES_META_PATH.write_text(json.dumps(meta, indent=2, ensure_ascii=False))
    return long, meta


def load_features() -> tuple[pd.DataFrame, dict]:
    return pd.read_parquet(FEATURES_PATH), json.loads(FEATURES_META_PATH.read_text())


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    C.ensure_dirs()
    df, meta = build_features()
    print(f"[features] filas={meta['n_rows']:,}  features={meta['n_features']}  bloques={meta['block_sizes']}")
    miss = df.isna().mean().sort_values(ascending=False)
    print("[features] top missingness:", miss.head(8).round(2).to_dict())
