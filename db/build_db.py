#!/usr/bin/env python3
"""
Construye la base de datos relacional (SQLite) a partir de los 9 CSV crudos
del dataset HackSpain X-Ray (data/raw/*.csv), aplicando el esquema normalizado
de db/schema.sql.

Uso:
    python3 db/build_db.py [--raw-dir data/raw] [--out db/finhackers.db]

Qué hace:
  1. Crea (o recrea) la base con db/schema.sql.
  2. Normaliza tipos al cargar: strings vacíos -> NULL, numéricos -> float/int,
     fechas se dejan como TEXT ISO-8601 (SQLite no tiene tipo DATE nativo;
     quedan ordenables/comparables tal cual).
  3. Unifica banking_products.csv + debt_products.csv en `products` +
     `debt_product_details`.
  4. Construye `counterparties` a partir de los counterparty_id distintos de
     transactions.csv e invoices.csv (dimensión derivada, no viene en el CSV).
  5. Carga transactions.csv e invoices.csv en streaming por lotes (no carga
     los 2,5M / 900k registros en memoria de golpe).
  6. Al final corre PRAGMA foreign_key_check y deja el resultado en el log.

Pensado para volver a ejecutarse tal cual si el CSV de origen cambia
(--force sobreescribe la base existente).
"""

from __future__ import annotations

import argparse
import csv
import sqlite3
import sys
import time
from pathlib import Path

csv.field_size_limit(10_000_000)  # descripciones/concepts largos con saltos de línea

BATCH_SIZE = 20_000


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def to_num(v: str):
    if v is None or v == "":
        return None
    try:
        f = float(v)
        return int(f) if f.is_integer() else f
    except ValueError:
        return v  # deja el valor tal cual si no es numérico (no debería pasar)


def to_text(v: str):
    return v if v not in (None, "") else None


def rows(path: Path):
    with path.open(newline="", encoding="utf-8") as f:
        yield from csv.DictReader(f)


def executemany_batched(cur: sqlite3.Cursor, sql: str, iterable):
    batch = []
    n = 0
    for item in iterable:
        batch.append(item)
        if len(batch) >= BATCH_SIZE:
            cur.executemany(sql, batch)
            n += len(batch)
            batch.clear()
    if batch:
        cur.executemany(sql, batch)
        n += len(batch)
    return n


def load_groups(cur, raw_dir: Path):
    log("groups.csv")
    def gen():
        for r in rows(raw_dir / "groups.csv"):
            yield (r["group_id"], to_text(r["erp"]), to_num(r["n_companies_in_sample"]))
    n = executemany_batched(
        cur, "INSERT INTO groups (group_id, erp, n_companies_in_sample) VALUES (?, ?, ?)", gen()
    )
    log(f"  -> {n} filas")


def load_companies(cur, raw_dir: Path):
    log("companies.csv")
    def gen():
        for r in rows(raw_dir / "companies.csv"):
            yield (
                r["company_id"], to_text(r["group_id"]), to_text(r["country"]),
                to_text(r["currency"]), to_text(r["erp"]), to_text(r["created_at"]),
            )
    n = executemany_batched(
        cur,
        "INSERT INTO companies (company_id, group_id, country, currency, erp, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        gen(),
    )
    log(f"  -> {n} filas")


def load_products(cur, raw_dir: Path):
    log("banking_products.csv + debt_products.csv -> products / debt_product_details")

    def gen_banking():
        for r in rows(raw_dir / "banking_products.csv"):
            yield (
                r["product_id"], r["company_id"], "banking", to_text(r["label"]),
                to_text(r["type"]), to_text(r["bank_name"]), to_text(r["service"]),
                to_text(r["currency"]), to_text(r["created_at"]),
            )

    def gen_debt():
        for r in rows(raw_dir / "debt_products.csv"):
            yield (
                r["product_id"], r["company_id"], "debt", to_text(r["label"]),
                to_text(r["type"]), to_text(r["bank_name"]), to_text(r["service"]),
                to_text(r["currency"]), to_text(r["created_at"]),
            )

    insert_products = (
        "INSERT INTO products (product_id, company_id, kind, label, type, bank_name, "
        "service, currency, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    n1 = executemany_batched(cur, insert_products, gen_banking())
    n2 = executemany_batched(cur, insert_products, gen_debt())
    log(f"  -> {n1} banking + {n2} debt = {n1 + n2} productos")

    def gen_debt_details():
        for r in rows(raw_dir / "debt_products.csv"):
            yield (r["product_id"], to_num(r["granted"]), to_num(r["outstanding"]), to_num(r["liquidity"]))

    n3 = executemany_batched(
        cur,
        "INSERT INTO debt_product_details (product_id, granted, outstanding, liquidity) VALUES (?, ?, ?, ?)",
        gen_debt_details(),
    )
    log(f"  -> {n3} debt_product_details")


def load_debt_schedule_config(cur, raw_dir: Path):
    log("debt_schedule_config.csv")

    def gen():
        for r in rows(raw_dir / "debt_schedule_config.csv"):
            yield (
                r["product_id"], r["company_id"], to_text(r["settlement_product_id"]),
                to_text(r["currency"]), to_text(r["amortization_type"]),
                to_text(r["interest_calc_method"]), to_text(r["amortising_frequency"]),
                to_num(r["granted_balance"]), to_num(r["outstanding_balance"]),
                to_num(r["total_periods"]), to_text(r["next_payment_date"]),
                to_text(r["last_payment_date"]), to_num(r["annual_interest_rate_or_spread"]),
                to_text(r["interest_type"]),
            )

    n = executemany_batched(
        cur,
        "INSERT INTO debt_schedule_config (product_id, company_id, settlement_product_id, "
        "currency, amortization_type, interest_calc_method, amortising_frequency, "
        "granted_balance, outstanding_balance, total_periods, next_payment_date, "
        "last_payment_date, annual_interest_rate_or_spread, interest_type) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        gen(),
    )
    log(f"  -> {n} filas")


def load_balances(cur, raw_dir: Path):
    log("balances.csv")

    def gen():
        for r in rows(raw_dir / "balances.csv"):
            yield (
                r["product_id"], r["company_id"], to_text(r["date"]), to_num(r["balance"]),
                to_num(r["available"]), to_num(r["granted"]), to_num(r["liquidity"]),
                to_num(r["countable"]),
            )

    n = executemany_batched(
        cur,
        "INSERT INTO balances (product_id, company_id, date, balance, available, granted, "
        "liquidity, countable) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        gen(),
    )
    log(f"  -> {n} filas")


def collect_counterparties(raw_dir: Path) -> set[str]:
    log("Escaneando counterparty_id distintos en transactions.csv e invoices.csv")
    ids: set[str] = set()
    for fname in ("transactions.csv", "invoices.csv"):
        for r in rows(raw_dir / fname):
            cp = r.get("counterparty_id")
            if cp:
                ids.add(cp)
    log(f"  -> {len(ids)} counterparties distintas")
    return ids


def load_counterparties(cur, ids: set[str]):
    n = executemany_batched(
        cur, "INSERT INTO counterparties (counterparty_id) VALUES (?)", ((i,) for i in sorted(ids))
    )
    log(f"  -> {n} counterparties insertadas")


def load_transactions(cur, raw_dir: Path):
    log("transactions.csv (streaming, puede tardar unos minutos)")

    def gen():
        for r in rows(raw_dir / "transactions.csv"):
            yield (
                r["transaction_id"], r["company_id"], r["product_id"], to_text(r["date"]),
                to_text(r["value_date"]), to_num(r["amount"]), to_num(r["exchange_rate"]),
                to_text(r["status"]), to_text(r["accounting_status"]), to_text(r["category"]),
                to_text(r["description"]), to_text(r["counterparty_id"]),
            )

    n = executemany_batched(
        cur,
        "INSERT INTO transactions (transaction_id, company_id, product_id, date, value_date, "
        "amount, exchange_rate, status, accounting_status, category, description, counterparty_id) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        gen(),
    )
    log(f"  -> {n} filas")


def load_invoices(cur, raw_dir: Path):
    log("invoices.csv (streaming)")

    def gen():
        for r in rows(raw_dir / "invoices.csv"):
            yield (
                r["operation_id"], r["company_id"], to_text(r["document_type"]),
                to_text(r["issuance_date"]), to_text(r["due_date"]), to_text(r["payment_date"]),
                to_num(r["amount"]), to_num(r["pending_amount"]), to_text(r["currency"]),
                to_text(r["accounting_currency"]), to_num(r["exchange_rate"]), to_text(r["status"]),
                to_text(r["concept"]), to_text(r["counterparty_id"]),
            )

    n = executemany_batched(
        cur,
        "INSERT INTO invoices (operation_id, company_id, document_type, issuance_date, due_date, "
        "payment_date, amount, pending_amount, currency, accounting_currency, exchange_rate, "
        "status, concept, counterparty_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        gen(),
    )
    log(f"  -> {n} filas")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw-dir", default="data/raw", help="Carpeta con los CSV crudos")
    ap.add_argument("--out", default="db/finhackers.db", help="Fichero SQLite de salida")
    ap.add_argument("--schema", default="db/schema.sql", help="DDL a aplicar")
    ap.add_argument("--force", action="store_true", help="Sobreescribe la base si ya existe")
    args = ap.parse_args()

    raw_dir = Path(args.raw_dir)
    out_path = Path(args.out)
    schema_path = Path(args.schema)

    if not raw_dir.exists():
        sys.exit(f"No existe {raw_dir}. Descomprime output_hackspain_data.zip ahí primero.")

    if out_path.exists():
        if not args.force:
            sys.exit(f"{out_path} ya existe. Usa --force para recrearla.")
        out_path.unlink()

    t0 = time.time()
    conn = sqlite3.connect(out_path)
    conn.executescript(schema_path.read_text(encoding="utf-8"))
    conn.execute("PRAGMA foreign_keys = OFF")  # se activa al final para no pagar el coste durante la carga masiva
    cur = conn.cursor()

    load_groups(cur, raw_dir)
    load_companies(cur, raw_dir)
    load_products(cur, raw_dir)
    load_debt_schedule_config(cur, raw_dir)
    load_balances(cur, raw_dir)

    counterparty_ids = collect_counterparties(raw_dir)
    load_counterparties(cur, counterparty_ids)

    load_transactions(cur, raw_dir)
    load_invoices(cur, raw_dir)

    conn.commit()

    log("Verificando integridad referencial (PRAGMA foreign_key_check)...")
    conn.execute("PRAGMA foreign_keys = ON")
    problems = conn.execute("PRAGMA foreign_key_check").fetchall()
    if problems:
        log(f"  !! {len(problems)} violaciones de FK encontradas:")
        for p in problems[:20]:
            log(f"     {p}")
    else:
        log("  -> sin violaciones de FK")

    log("Actualizando estadísticas (ANALYZE)...")
    conn.execute("ANALYZE")
    conn.commit()
    conn.close()

    log(f"Listo: {out_path} ({out_path.stat().st_size / 1e6:.1f} MB) en {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
