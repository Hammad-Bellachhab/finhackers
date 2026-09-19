"""Capa 1 — Ingestión: CSV → Parquet tipado, particionado y con informe de calidad.

Única capa que toca los CSV originales. Reglas:
  * lectura en streaming con DuckDB (nunca se carga transactions.csv entero en pandas);
  * tipado explícito con TRY_CAST y *conteo* de todo valor que no se pudo parsear;
  * Parquet zstd, particionado por mes en las tablas de hechos;
  * informe de calidad (filas, nulos, huérfanos, rangos de fechas) en data/quality/.
"""
from __future__ import annotations

import hashlib
import json
import shutil
import sys
import time
from datetime import datetime, timezone

import duckdb

from src import config as C

# Esquema explícito: columna -> tipo DuckDB. Lo que no aparece se guarda como VARCHAR.
SCHEMAS: dict[str, dict[str, str]] = {
    "groups": {"n_companies_in_sample": "INTEGER"},
    "companies": {"created_at": "TIMESTAMP"},
    "banking_products": {"created_at": "TIMESTAMP"},
    "debt_products": {"created_at": "TIMESTAMP", "granted": "DOUBLE", "outstanding": "DOUBLE", "liquidity": "DOUBLE"},
    "debt_schedule_config": {
        "granted_balance": "DOUBLE", "outstanding_balance": "DOUBLE", "total_periods": "INTEGER",
        "next_payment_date": "TIMESTAMP", "last_payment_date": "TIMESTAMP",
        "annual_interest_rate_or_spread": "DOUBLE",
    },
    "balances": {"date": "TIMESTAMP", "balance": "DOUBLE", "available": "DOUBLE", "granted": "DOUBLE",
                 "liquidity": "DOUBLE", "countable": "DOUBLE"},
    "invoices": {"issuance_date": "TIMESTAMP", "due_date": "TIMESTAMP", "payment_date": "TIMESTAMP",
                 "amount": "DOUBLE", "pending_amount": "DOUBLE", "exchange_rate": "DOUBLE"},
    "transactions": {"date": "TIMESTAMP", "value_date": "TIMESTAMP", "amount": "DOUBLE", "exchange_rate": "DOUBLE"},
}
# Tablas de hechos: se particionan por mes de esta columna.
FACT_DATE_COL = {"transactions": "date", "invoices": "issuance_date"}
# Normalizaciones de texto puntuales (país escrito de tres formas distintas).
COUNTRY_MAP = {"ESPAÑA": "ES", "ESPANA": "ES", "SPAIN": "ES"}


def file_sha256(path, chunk=1 << 24) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            b = f.read(chunk)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def _typed_select(con: duckdb.DuckDBPyConnection, name: str) -> tuple[str, list[str]]:
    """Construye el SELECT tipado a partir de las columnas reales del CSV."""
    cols = [r[0] for r in con.execute(f"DESCRIBE SELECT * FROM raw_{name}").fetchall()]
    exprs = []
    for c in cols:
        t = SCHEMAS[name].get(c)
        if t is None:
            e = f"nullif(trim(\"{c}\"), '')"
            if c == "country":
                e = (f"CASE WHEN upper({e}) IN ('ESPAÑA','ESPANA','SPAIN') THEN 'ES' "
                     f"ELSE upper({e}) END")
            exprs.append(f"{e} AS \"{c}\"")
        else:
            exprs.append(f"TRY_CAST(nullif(trim(\"{c}\"), '') AS {t}) AS \"{c}\"")
    return ", ".join(exprs), cols


def ingest_table(con: duckdb.DuckDBPyConnection, name: str, log: dict) -> None:
    src = C.RAW_DIR / f"{name}.csv"
    t0 = time.time()
    # Todo como VARCHAR: el tipado se hace nosotros, con conteo de fallos.
    con.execute(f"CREATE OR REPLACE VIEW raw_{name} AS SELECT * FROM read_csv('{src.as_posix()}', "
                f"all_varchar=true, header=true, sample_size=-1)")
    select, cols = _typed_select(con, name)
    con.execute(f"CREATE OR REPLACE TABLE {name} AS SELECT {select} FROM raw_{name}")

    # --- Calidad: filas, nulos, fallos de parseo por columna tipada -----------------
    n_rows = con.execute(f"SELECT count(*) FROM {name}").fetchone()[0]
    null_counts = {}
    parse_failures = {}
    for c in cols:
        nulls = con.execute(f"SELECT count(*) FROM {name} WHERE \"{c}\" IS NULL").fetchone()[0]
        null_counts[c] = int(nulls)
        if c in SCHEMAS[name]:
            fails = con.execute(
                f"SELECT count(*) FROM raw_{name} r WHERE nullif(trim(r.\"{c}\"), '') IS NOT NULL "
                f"AND TRY_CAST(nullif(trim(r.\"{c}\"), '') AS {SCHEMAS[name][c]}) IS NULL").fetchone()[0]
            parse_failures[c] = int(fails)

    date_ranges = {}
    for c, t in SCHEMAS[name].items():
        if t == "TIMESTAMP":
            lo, hi, out = con.execute(
                f"SELECT min(\"{c}\"), max(\"{c}\"), count(*) FILTER (WHERE \"{c}\" < TIMESTAMP '2023-01-01' "
                f"OR \"{c}\" > TIMESTAMP '2028-12-31') FROM {name}").fetchone()
            date_ranges[c] = {"min": str(lo), "max": str(hi), "out_of_range_2023_2028": int(out)}

    # --- Escritura Parquet --------------------------------------------------------
    out = C.PARQUET_DIR / name
    if out.exists():
        shutil.rmtree(out)
    if name in FACT_DATE_COL:
        dc = FACT_DATE_COL[name]
        con.execute(
            f"COPY (SELECT *, strftime(\"{dc}\", '%Y-%m') AS year_month FROM {name}) "
            f"TO '{out.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD, PARTITION_BY (year_month), OVERWRITE_OR_IGNORE)")
    else:
        out.mkdir(parents=True)
        con.execute(f"COPY {name} TO '{(out / 'data.parquet').as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)")

    log[name] = {
        "source": str(src), "sha256": file_sha256(src), "rows": int(n_rows), "columns": cols,
        "null_counts": null_counts, "parse_failures": parse_failures, "date_ranges": date_ranges,
        "seconds": round(time.time() - t0, 1),
    }
    print(f"  {name:22s} {n_rows:>10,d} filas  parse_failures={sum(parse_failures.values())}  "
          f"({log[name]['seconds']}s)", flush=True)


def referential_integrity(con: duckdb.DuckDBPyConnection) -> dict:
    """company_id / product_id huérfanos: se registran, no se corrigen en silencio."""
    checks = {
        "companies.group_id_orphans": "SELECT count(*) FROM companies c LEFT JOIN groups g USING(group_id) WHERE g.group_id IS NULL",
        "banking_products.company_orphans": "SELECT count(*) FROM banking_products p LEFT JOIN companies c USING(company_id) WHERE c.company_id IS NULL",
        "debt_products.company_orphans": "SELECT count(*) FROM debt_products p LEFT JOIN companies c USING(company_id) WHERE c.company_id IS NULL",
        "balances.company_orphans": "SELECT count(*) FROM balances b LEFT JOIN companies c USING(company_id) WHERE c.company_id IS NULL",
        "balances.product_orphans": "SELECT count(*) FROM balances b WHERE product_id NOT IN (SELECT product_id FROM banking_products UNION ALL SELECT product_id FROM debt_products)",
        "transactions.company_orphans": "SELECT count(*) FROM transactions t LEFT JOIN companies c USING(company_id) WHERE c.company_id IS NULL",
        "transactions.product_orphans": "SELECT count(*) FROM transactions t WHERE product_id NOT IN (SELECT product_id FROM banking_products UNION ALL SELECT product_id FROM debt_products)",
        "invoices.company_orphans": "SELECT count(*) FROM invoices i LEFT JOIN companies c USING(company_id) WHERE c.company_id IS NULL",
        "companies.without_transactions": "SELECT count(*) FROM companies c WHERE company_id NOT IN (SELECT DISTINCT company_id FROM transactions)",
        "companies.without_invoices": "SELECT count(*) FROM companies c WHERE company_id NOT IN (SELECT DISTINCT company_id FROM invoices)",
    }
    return {k: int(con.execute(q).fetchone()[0]) for k, q in checks.items()}


def dataset_hash(log: dict) -> str:
    """Hash global del dataset = hash de los hashes de los ficheros, en orden fijo."""
    h = hashlib.sha256()
    for name in C.RAW_FILES:
        h.update(log[name]["sha256"].encode())
    return h.hexdigest()[:16]


def run() -> dict:
    C.ensure_dirs()
    print(f"[ingest] RAW_DIR={C.RAW_DIR}")
    con = duckdb.connect()
    con.execute(f"SET threads TO 4; SET memory_limit='6GB'; SET temp_directory='{(C.DATA_DIR / 'tmp').as_posix()}'")
    log: dict = {}
    for name in C.RAW_FILES:
        ingest_table(con, name, log)
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dataset_hash": dataset_hash(log),
        "tables": log,
        "referential_integrity": referential_integrity(con),
    }
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    (C.QUALITY_DIR / f"quality_report_{ts}.json").write_text(json.dumps(report, indent=2, ensure_ascii=False))
    (C.QUALITY_DIR / "quality_report_latest.json").write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"[ingest] dataset_hash={report['dataset_hash']}")
    print("[ingest] integridad referencial:", json.dumps(report["referential_integrity"], indent=None))
    return report


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    run()
