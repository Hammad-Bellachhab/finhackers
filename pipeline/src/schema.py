"""Capa 2 — Modelo de datos: esquema estrella sobre Parquet y agregados empresa × mes.

Dimensiones: dim_company, dim_group, dim_product, dim_bank, dim_counterparty (derivada).
Hechos:      fact_transaction, fact_invoice, fact_balance.
Derivadas:   cm_tx, cm_cash, cm_invoice_lag, cm_concentration  (grano empresa × mes T).

Todas las agregaciones pesadas se hacen aquí en SQL (DuckDB); las capas 3 y 4 solo
trabajan con tablas de ~30 k filas en pandas.
"""
from __future__ import annotations

import sys
import time

import duckdb
import pandas as pd

from src import config as C

CM_DIR = C.PARQUET_DIR / "company_month"


def _pq(name: str) -> str:
    """Ruta glob de una tabla Parquet (particionada o no)."""
    return f"read_parquet('{(C.PARQUET_DIR / name).as_posix()}/**/*.parquet', hive_partitioning=true, union_by_name=true)"


def connect(threads: int = 1) -> duckdb.DuckDBPyConnection:
    """Conexión DuckDB con el esquema estrella registrado como vistas.

    threads=1 por defecto: las agregaciones paralelas suman en coma flotante en orden no determinista
    y cambian el último bit entre ejecuciones (suficiente para mover algún umbral). Un hilo cuesta ~20 s más
    y hace el pipeline reproducible bit a bit con la misma semilla.
    """
    con = duckdb.connect()
    con.execute(f"SET threads TO {threads}; SET memory_limit='6GB'; "
                f"SET temp_directory='{(C.DATA_DIR / 'tmp').as_posix()}'")
    con.execute(f"""
    CREATE VIEW dim_group AS SELECT * FROM {_pq('groups')};
    CREATE VIEW dim_company AS
        SELECT c.*, g.n_companies_in_sample AS group_size, coalesce(c.erp, g.erp) AS erp_any
        FROM {_pq('companies')} c LEFT JOIN {_pq('groups')} g USING(group_id);
    CREATE VIEW dim_product AS
        SELECT product_id, company_id, label, type, bank_name, service, currency, created_at,
               NULL::DOUBLE AS granted, NULL::DOUBLE AS outstanding, NULL::DOUBLE AS liquidity,
               FALSE AS is_debt, type IN ('checking','saving') AS is_cash
        FROM {_pq('banking_products')}
        UNION ALL
        SELECT product_id, company_id, label, type, bank_name, service, currency, created_at,
               granted, outstanding, liquidity, TRUE, FALSE
        FROM {_pq('debt_products')};
    CREATE VIEW dim_debt_schedule AS SELECT * FROM {_pq('debt_schedule_config')};
    CREATE VIEW dim_bank AS
        SELECT bank_name, count(*) AS n_products, count(DISTINCT company_id) AS n_companies
        FROM dim_product GROUP BY 1;
    CREATE VIEW fact_balance AS SELECT * FROM {_pq('balances')};
    CREATE VIEW fact_transaction AS
        SELECT t.*, p.type AS product_type, p.bank_name, p.is_cash, p.is_debt
        FROM {_pq('transactions')} t LEFT JOIN dim_product p USING(product_id);
    -- Facturas limpias: se descartan canceladas, importe 0 y fechas fuera de rango (contadas en QA).
    CREATE VIEW fact_invoice AS
        SELECT *,
               amount < 0 AS is_payable,
               CASE WHEN status = 'paid' THEN payment_date END AS paid_date
        FROM {_pq('invoices')}
        WHERE status <> 'cancel' AND amount <> 0
          AND due_date BETWEEN TIMESTAMP '2024-01-01' AND TIMESTAMP '2027-12-31'
          AND (payment_date IS NULL OR payment_date BETWEEN TIMESTAMP '2024-01-01' AND TIMESTAMP '2027-12-31');
    CREATE VIEW dim_counterparty AS
        SELECT counterparty_id, company_id, count(*) AS n_tx,
               sum(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS inflow,
               sum(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS outflow
        FROM {_pq('transactions')} WHERE counterparty_id IS NOT NULL GROUP BY 1, 2;
    """)
    # Rejilla temporal: un T por mes (fin de mes).
    grid = pd.DataFrame({"T": C.month_range()})
    grid["T_start"] = pd.to_datetime(grid["T"] + "-01")
    grid["T_next"] = grid["T_start"] + pd.offsets.MonthBegin(1)
    grid["T_end"] = grid["T_next"] - pd.Timedelta(seconds=1)
    con.register("grid_df", grid)
    con.execute("CREATE TABLE grid AS SELECT * FROM grid_df")
    return con


# --------------------------------------------------------------------------------------
# Agregados empresa × mes
# --------------------------------------------------------------------------------------
SQL_CM_TX = f"""
CREATE OR REPLACE TABLE cm_tx AS
SELECT company_id, strftime(date, '%Y-%m') AS T,
    count(*)                                                                AS n_tx,
    count(DISTINCT product_id)                                              AS n_active_accounts,
    sum(CASE WHEN amount > 0 THEN amount ELSE 0 END)                        AS inflow_total,
    sum(CASE WHEN amount < 0 THEN -amount ELSE 0 END)                       AS outflow_total,
    -- flujos operativos: se excluyen movimientos financieros / internos
    sum(CASE WHEN amount > 0 AND coalesce(category,'-') NOT IN ('investment_return','payment_refund','transfer','collection_refund') THEN amount ELSE 0 END) AS inflow_oper,
    sum(CASE WHEN amount < 0 AND coalesce(category,'-') NOT IN ('investment_deployment','transfer','debt_repayment') THEN -amount ELSE 0 END) AS outflow_oper,
    sum(CASE WHEN category = 'collection' AND amount > 0 THEN amount ELSE 0 END)      AS amt_collection,
    sum(CASE WHEN category = 'payment' AND amount < 0 THEN -amount ELSE 0 END)        AS amt_payment,
    count(*) FILTER (WHERE category = 'interest_charge')                             AS n_interest_charge,
    sum(CASE WHEN category = 'interest_charge' THEN -amount ELSE 0 END)              AS amt_interest_charge,
    count(*) FILTER (WHERE category = 'fee')                                         AS n_fee,
    sum(CASE WHEN category = 'fee' THEN -amount ELSE 0 END)                          AS amt_fee,
    count(*) FILTER (WHERE category = 'debt_repayment')                              AS n_debt_repayment,
    sum(CASE WHEN category = 'debt_repayment' THEN -amount ELSE 0 END)               AS amt_debt_repayment,
    count(*) FILTER (WHERE category = 'salary')                                      AS n_salary,
    sum(CASE WHEN category = 'salary' THEN -amount ELSE 0 END)                       AS amt_salary,
    avg(CASE WHEN category = 'salary' THEN day(date) END)                            AS salary_day_mean,
    max(CASE WHEN category = 'salary' THEN day(date) END)                            AS salary_day_max,
    count(*) FILTER (WHERE category = 'social_security')                             AS n_social_security,
    sum(CASE WHEN category = 'social_security' THEN -amount ELSE 0 END)              AS amt_social_security,
    avg(CASE WHEN category = 'social_security' THEN day(date) END)                   AS ss_day_mean,
    count(*) FILTER (WHERE category = 'tax')                                         AS n_tax,
    sum(CASE WHEN category = 'tax' THEN -amount ELSE 0 END)                          AS amt_tax,
    count(*) FILTER (WHERE category IN ('collection_refund','payment_refund'))       AS n_refund,
    count(*) FILTER (WHERE category = 'cash_withdrawal')                             AS n_cash_withdrawal,
    count(*) FILTER (WHERE regexp_matches(lower(coalesce(description,'')), '{C.STRESS_TERMS_REGEX}')) AS n_stress_terms,
    count(*) FILTER (WHERE counterparty_id IS NULL)                                  AS n_no_counterparty,
    count(*) FILTER (WHERE accounting_status IS NULL)                                AS n_no_accounting,
    count(*) FILTER (WHERE accounting_status = 'DISCARDED')                          AS n_discarded,
    count(*) FILTER (WHERE accounting_status IN ('RECONCILIATION_COMPLETED','ACCOUNTING_COMPLETED')) AS n_reconciled,
    count(*) FILTER (WHERE status = 'pending')                                       AS n_status_pending,
    count(*) FILTER (WHERE coalesce(category,'-') = '-')                             AS n_uncategorized,
    count(*) FILTER (WHERE is_debt)                                                  AS n_tx_debt_products,
    count(DISTINCT counterparty_id)                                                  AS n_counterparties,
    count(DISTINCT date_trunc('day', date))                                          AS n_active_days
FROM fact_transaction
WHERE date < TIMESTAMP '{C.DATA_END}'
GROUP BY 1, 2;
"""

# Saldo reconstruido a fin de mes: saldo_foto - suma(movimientos posteriores a T hasta la foto).
SQL_CM_CASH = f"""
CREATE OR REPLACE TABLE cm_cash AS
WITH prod AS (
    SELECT b.product_id, b.company_id, b.date AS snap_date, b.balance, p.type, p.is_cash, p.is_debt,
           p.granted, p.bank_name
    FROM fact_balance b JOIN dim_product p USING(product_id)
    WHERE p.type IN ('checking','saving','lineofcredit','card')
),
later AS (
    SELECT t.product_id, g.T, sum(t.amount) AS s
    FROM {_pq('transactions')} t
    JOIN prod pr USING(product_id)
    JOIN grid g ON t.date >= g.T_next AND t.date <= pr.snap_date + INTERVAL 1 DAY
    GROUP BY 1, 2
),
rec AS (
    SELECT pr.company_id, g.T, pr.product_id, pr.type, pr.is_cash, pr.granted, pr.bank_name,
           pr.balance - coalesce(l.s, 0) AS bal_T
    FROM prod pr CROSS JOIN grid g
    LEFT JOIN later l ON l.product_id = pr.product_id AND l.T = g.T
)
SELECT company_id, T,
    sum(CASE WHEN is_cash THEN bal_T END)                                     AS cash_balance,
    min(CASE WHEN is_cash THEN bal_T END)                                     AS cash_min_account,
    count(*) FILTER (WHERE is_cash AND bal_T < 0)                             AS n_cash_accounts_neg,
    count(*) FILTER (WHERE is_cash)                                           AS n_cash_accounts,
    sum(CASE WHEN type = 'lineofcredit' THEN -least(bal_T, 0) END)           AS credit_drawn,
    sum(CASE WHEN type = 'lineofcredit' THEN abs(coalesce(granted, 0)) END)   AS credit_granted,
    sum(CASE WHEN type = 'card' THEN -least(bal_T, 0) END)                    AS card_drawn
FROM rec
GROUP BY 1, 2;
"""

# Estado de las facturas observado en T, por mes de vencimiento (lag 0..11) y tipo (a pagar / a cobrar).
SQL_CM_INVOICE_LAG = f"""
CREATE OR REPLACE TABLE cm_invoice_lag AS
WITH j AS (
    SELECT i.company_id, g.T, i.is_payable,
           date_diff('month', date_trunc('month', i.due_date), g.T_start) AS lag,
           abs(i.amount) AS amt,
           (i.paid_date IS NOT NULL AND i.paid_date < g.T_next) AS resolved,
           CASE WHEN i.paid_date IS NOT NULL AND i.paid_date < g.T_next
                THEN date_diff('day', i.due_date, i.paid_date)
                ELSE date_diff('day', i.due_date, g.T_end) END AS dpd,
           date_diff('day', i.issuance_date, i.due_date) AS term_days
    FROM fact_invoice i
    JOIN grid g ON i.due_date >= g.T_start - INTERVAL 11 MONTH AND i.due_date < g.T_next
)
SELECT company_id, T, is_payable, lag,
    count(*)                                                    AS n,
    sum(amt)                                                    AS amt,
    avg(greatest(dpd, -60))                                     AS dpd_mean,
    quantile_cont(greatest(dpd, -60), 0.5)                      AS dpd_p50,
    quantile_cont(greatest(dpd, -60), 0.9)                      AS dpd_p90,
    avg(CASE WHEN dpd > {C.DPD_BAD_DAYS} THEN 1.0 ELSE 0.0 END) AS bad_share,
    avg(CASE WHEN NOT resolved AND dpd > 0 THEN 1.0 ELSE 0.0 END) AS open_overdue_share,
    sum(CASE WHEN NOT resolved AND dpd > 0 THEN amt ELSE 0 END) AS amt_open_overdue,
    sum(CASE WHEN NOT resolved THEN amt ELSE 0 END)             AS amt_open,
    max(CASE WHEN NOT resolved THEN dpd END)                    AS max_open_dpd,
    avg(term_days)                                              AS term_days_mean
FROM j
GROUP BY 1, 2, 3, 4;
"""

# Facturas emitidas por mes (actividad del ERP), independiente del vencimiento.
SQL_CM_INVOICE_ISSUED = """
CREATE OR REPLACE TABLE cm_invoice_issued AS
SELECT company_id, strftime(issuance_date, '%Y-%m') AS T,
    count(*)                                         AS n_inv_issued,
    count(*) FILTER (WHERE is_payable)               AS n_inv_payable,
    count(*) FILTER (WHERE NOT is_payable)           AS n_inv_receivable,
    sum(CASE WHEN is_payable THEN -amount ELSE 0 END)     AS amt_inv_payable,
    sum(CASE WHEN NOT is_payable THEN amount ELSE 0 END)  AS amt_inv_receivable,
    count(*) FILTER (WHERE counterparty_id IS NULL)  AS n_inv_no_counterparty,
    count(*) FILTER (WHERE regexp_matches(lower(coalesce(concept,'')), 'devol|impag|reclam|demora|mora\\b|abono|rectific')) AS n_inv_stress_terms,
    count(DISTINCT counterparty_id)                  AS n_inv_counterparties
FROM fact_invoice
GROUP BY 1, 2;
"""

# Estado FINAL de cada factura a la fecha de la foto, por mes de vencimiento. Solo lo usa la
# etiqueta (Capa 3): una factura es "mala" si se pagó con DPD > 30 o sigue impagada > 30 días
# después de vencer. Las vencidas hace < 30 días no son clasificables (censura) y se excluyen.
SQL_CM_INVOICE_OUTCOME = f"""
CREATE OR REPLACE TABLE cm_invoice_outcome AS
WITH i AS (
    SELECT company_id, strftime(due_date, '%Y-%m') AS due_month, is_payable, abs(amount) AS amt,
           CASE WHEN paid_date IS NOT NULL THEN date_diff('day', due_date, paid_date)
                ELSE date_diff('day', due_date, TIMESTAMP '{C.SNAPSHOT_DATE}') END AS dpd_final,
           (paid_date IS NOT NULL OR date_diff('day', due_date, TIMESTAMP '{C.SNAPSHOT_DATE}') > {C.DPD_BAD_DAYS}) AS classifiable
    FROM fact_invoice
)
SELECT company_id, due_month, is_payable,
    count(*) FILTER (WHERE classifiable)                                  AS n_classifiable,
    count(*) FILTER (WHERE classifiable AND dpd_final > {C.DPD_BAD_DAYS}) AS n_bad,
    sum(amt) FILTER (WHERE classifiable)                                  AS amt_classifiable,
    sum(amt) FILTER (WHERE classifiable AND dpd_final > {C.DPD_BAD_DAYS}) AS amt_bad
FROM i GROUP BY 1, 2, 3;
"""

# Concentración de contrapartidas (HHI) en ventana de 6 meses y rotación frente a los 6 anteriores.
SQL_CM_CONCENTRATION = f"""
CREATE OR REPLACE TABLE cm_concentration AS
WITH w AS (
    SELECT t.company_id, g.T, t.counterparty_id,
           CASE WHEN t.date >= g.T_start - INTERVAL 5 MONTH THEN 'cur' ELSE 'prev' END AS win,
           sum(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) AS inflow,
           sum(CASE WHEN t.amount < 0 THEN -t.amount ELSE 0 END) AS outflow
    FROM {_pq('transactions')} t
    JOIN grid g ON t.date >= g.T_start - INTERVAL 11 MONTH AND t.date < g.T_next
    WHERE t.counterparty_id IS NOT NULL
    GROUP BY 1, 2, 3, 4
),
cur AS (
    SELECT company_id, T,
        sum(inflow) AS inflow_res, sum(outflow) AS outflow_res,
        sum(inflow * inflow) / nullif(sum(inflow) * sum(inflow), 0)   AS hhi_in,
        sum(outflow * outflow) / nullif(sum(outflow) * sum(outflow), 0) AS hhi_out,
        max(inflow) / nullif(sum(inflow), 0)                            AS top1_in_share,
        max(outflow) / nullif(sum(outflow), 0)                          AS top1_out_share,
        count(*) FILTER (WHERE inflow > 0)                              AS n_cp_in,
        count(*) FILTER (WHERE outflow > 0)                             AS n_cp_out
    FROM w WHERE win = 'cur' GROUP BY 1, 2
),
churn AS (
    SELECT p.company_id, p.T,
        count(*)                                                        AS n_cp_in_prev,
        count(*) FILTER (WHERE c.counterparty_id IS NULL)               AS n_cp_in_lost
    FROM (SELECT * FROM w WHERE win = 'prev' AND inflow > 0) p
    LEFT JOIN (SELECT * FROM w WHERE win = 'cur' AND inflow > 0) c
           ON c.company_id = p.company_id AND c.T = p.T AND c.counterparty_id = p.counterparty_id
    GROUP BY 1, 2
)
SELECT cur.*, churn.n_cp_in_prev, churn.n_cp_in_lost,
       churn.n_cp_in_lost / nullif(churn.n_cp_in_prev, 0) AS cp_in_churn
FROM cur LEFT JOIN churn USING(company_id, T);
"""


def build_company_month(con: duckdb.DuckDBPyConnection | None = None) -> None:
    """Materializa las tablas empresa × mes en data/parquet/company_month/."""
    own = con is None
    con = con or connect()
    CM_DIR.mkdir(parents=True, exist_ok=True)
    for name, sql in [("cm_tx", SQL_CM_TX), ("cm_cash", SQL_CM_CASH), ("cm_invoice_lag", SQL_CM_INVOICE_LAG),
                      ("cm_invoice_issued", SQL_CM_INVOICE_ISSUED), ("cm_invoice_outcome", SQL_CM_INVOICE_OUTCOME),
                      ("cm_concentration", SQL_CM_CONCENTRATION)]:
        t0 = time.time()
        con.execute(sql)
        n = con.execute(f"SELECT count(*) FROM {name}").fetchone()[0]
        con.execute(f"COPY {name} TO '{(CM_DIR / (name + '.parquet')).as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)")
        print(f"  {name:20s} {n:>9,d} filas ({time.time() - t0:.1f}s)", flush=True)
    # Dimensiones pequeñas también a Parquet (las capas siguientes no necesitan DuckDB).
    for name in ("dim_company", "dim_product", "dim_debt_schedule", "fact_balance"):
        con.execute(f"COPY (SELECT * FROM {name}) TO '{(CM_DIR / (name + '.parquet')).as_posix()}' (FORMAT PARQUET)")
    if own:
        con.close()


def load_cm(name: str) -> pd.DataFrame:
    return pd.read_parquet(CM_DIR / f"{name}.parquet")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    print("[schema] materializando tablas empresa × mes")
    build_company_month()
