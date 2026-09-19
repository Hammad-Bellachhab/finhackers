"""Genera un mini-dataset sintético con el mismo esquema que los 8 CSV del reto.

Sirve para el smoke test de CI (los CSV reales pesan 617 MB y no van en el repo). Unas empresas
se "deterioran" en la segunda mitad (facturas impagadas, caja negativa, caída de cobros) para que
la etiqueta tenga positivos y el pipeline completo tenga algo que aprender.

Uso:  python tests/make_sample_data.py <dir_destino> [n_empresas]
"""
from __future__ import annotations

import sys
import uuid
from pathlib import Path

import numpy as np
import pandas as pd

CATEGORIES = ["-", "collection", "payment", "utility", "fee", "transfer", "tax", "salary", "social_security",
              "debt_repayment", "interest_charge", "cash_withdrawal", "bulk_collection", "pos_settlement"]
BANKS = ["Banco Santander Empresas", "Caixabank Empresas", "BBVA Net Cash Empresas", "Banco Sabadell Empresas", "Bankinter Empresas", "Other (customer-defined)"]
ERPS = [None, "businessCentral", "netsuite", "sage200"]


def make(out: Path, n_companies: int = 48, seed: int = 7) -> None:
    rng = np.random.default_rng(seed)
    out.mkdir(parents=True, exist_ok=True)
    months = pd.period_range("2024-09", "2026-08", freq="M")
    n_groups = max(1, n_companies // 3)
    groups = pd.DataFrame({"group_id": [f"GROUP_{i:04d}" for i in range(1, n_groups + 1)],
                           "erp": rng.choice(ERPS, n_groups), "n_companies_in_sample": 0})
    comp_rows, prod_rows, debt_rows, sched_rows, bal_rows, tx_rows, inv_rows = [], [], [], [], [], [], []
    pid = 1
    for i in range(1, n_companies + 1):
        cid = f"COMP_{i:04d}"
        g = rng.integers(0, n_groups)
        groups.loc[g, "n_companies_in_sample"] += 1
        start_idx = int(rng.integers(0, 8))            # entra en el panel en distinto momento
        deteriorates = rng.random() < 0.3
        det_from = int(rng.integers(12, 20)) if deteriorates else 99
        has_inv = rng.random() < 0.65
        comp_rows.append({"company_id": cid, "group_id": groups.loc[g, "group_id"], "country": rng.choice([None, "ES", "ES", "FR"]),
                          "currency": "EUR", "erp": rng.choice(ERPS), "created_at": f"2024-{rng.integers(1, 12):02d}-15 10:00:00"})
        accounts = []
        for _ in range(int(rng.integers(1, 4))):
            p = f"PRODUCT_{pid:05d}"; pid += 1
            accounts.append(p)
            prod_rows.append({"product_id": p, "company_id": cid, "label": "CHECKING_01", "type": "checking", "bank_name": rng.choice(BANKS[:5]),
                              "service": "svc", "currency": "EUR", "created_at": "2024-06-01 10:00:00"})
        loc = None
        if rng.random() < 0.5:
            loc = f"PRODUCT_{pid:05d}"; pid += 1
            debt_rows.append({"product_id": loc, "company_id": cid, "label": "LINEOFCREDIT_01", "type": "lineofcredit", "bank_name": rng.choice(BANKS),
                              "service": "svc", "currency": "EUR", "created_at": "2024-06-01 10:00:00", "granted": -float(rng.integers(50, 500) * 1000), "outstanding": -10000.0, "liquidity": None})
        if rng.random() < 0.5:
            p = f"PRODUCT_{pid:05d}"; pid += 1
            granted = float(rng.integers(100, 2000) * 1000)
            debt_rows.append({"product_id": p, "company_id": cid, "label": "LOAN_01", "type": "loan", "bank_name": rng.choice(BANKS), "service": "svc",
                              "currency": "EUR", "created_at": "2024-06-01 10:00:00", "granted": -granted, "outstanding": -granted * 0.6, "liquidity": None})
            sched_rows.append({"product_id": p, "company_id": cid, "settlement_product_id": accounts[0], "currency": "EUR", "amortization_type": "constant quote",
                               "interest_calc_method": "30/360", "amortising_frequency": "monthly", "granted_balance": granted, "outstanding_balance": granted * 0.6,
                               "total_periods": 60, "next_payment_date": "2026-09-30 00:00:00", "last_payment_date": "2026-08-30 00:00:00",
                               "annual_interest_rate_or_spread": 0.04, "interest_type": "fixed"})
        scale = float(rng.integers(20, 300)) * 1000
        # saldo final coherente con las transacciones: se genera la serie y se toma la foto al final
        bal = {a: scale * rng.uniform(0.5, 2) for a in accounts}
        loc_bal = 0.0
        for mi, m in enumerate(months):
            if mi < start_idx:
                continue
            bad = mi >= det_from
            n_tx = int(rng.integers(8, 30)) if not (bad and mi >= det_from + 4) else int(rng.integers(0, 6))
            for _ in range(n_tx):
                cat = rng.choice(CATEGORIES)
                day = int(rng.integers(1, 28))
                amt = float(rng.lognormal(np.log(scale / 20), 0.8))
                if cat in ("collection", "bulk_collection", "pos_settlement", "transfer", "-"):
                    amt = amt * (0.4 if bad else 1.0)
                else:
                    amt = -amt
                if cat == "interest_charge":
                    amt = -abs(amt) * 0.05
                    if not bad and rng.random() < 0.8:
                        continue
                acc = rng.choice(accounts)
                bal[acc] += amt
                if loc and cat == "payment" and bad and rng.random() < 0.5:
                    loc_bal -= abs(amt)
                    acc = loc
                desc = rng.choice(["TRANSFERENCIA [COMPANY]", "RECIBO [X]", "PAGO NOMINA", "DEVOLUCION RECIBO IMPAGADO" if bad and rng.random() < 0.3 else "ADEUDO [REF]"])
                tx_rows.append({"transaction_id": uuid.uuid4().hex, "company_id": cid, "product_id": acc, "date": f"{m.year}-{m.month:02d}-{day:02d} 10:00:00",
                                "value_date": f"{m.year}-{m.month:02d}-{day:02d} 10:00:00", "amount": round(amt, 2), "exchange_rate": 1, "status": "booked",
                                "accounting_status": rng.choice([None, "RECONCILIATION_COMPLETED", "DISCARDED"]), "category": cat, "description": desc,
                                "counterparty_id": None if rng.random() < 0.7 else f"COUNTERPARTY_{rng.integers(1, 6):05d}"})
            if has_inv:
                for _ in range(int(rng.integers(3, 12))):
                    payable = rng.random() < 0.6
                    issue = pd.Timestamp(f"{m.year}-{m.month:02d}-{int(rng.integers(1, 28)):02d}")
                    due = issue + pd.Timedelta(days=30)
                    late = (bad and rng.random() < 0.6) or rng.random() < 0.1
                    dpd = int(rng.integers(35, 120)) if late else int(rng.integers(-3, 10))
                    pay = due + pd.Timedelta(days=dpd)
                    snapshot = pd.Timestamp("2026-09-01")
                    if pay > snapshot:
                        status, pay_str, pending = ("overdue" if due < snapshot else "pending"), due.strftime("%Y-%m-%d 00:00:00"), 1.0
                    else:
                        status, pay_str, pending = "paid", pay.strftime("%Y-%m-%d 00:00:00"), 0.0
                    amt = float(rng.integers(1, 50) * 100) * (-1 if payable else 1)
                    inv_rows.append({"operation_id": uuid.uuid4().hex, "company_id": cid, "document_type": "invoice", "issuance_date": issue.strftime("%Y-%m-%d 00:00:00"),
                                     "due_date": due.strftime("%Y-%m-%d 00:00:00"), "payment_date": pay_str, "amount": amt, "pending_amount": amt * pending,
                                     "currency": "EUR", "accounting_currency": "EUR", "exchange_rate": 1, "status": status,
                                     "concept": "Factura [NUM]", "counterparty_id": f"COUNTERPARTY_{rng.integers(1, 6):05d}"})
        for a in accounts:
            bal_rows.append({"product_id": a, "company_id": cid, "date": "2026-09-01 00:00:00", "balance": round(bal[a], 2), "available": None, "granted": None, "liquidity": None, "countable": None})
        if loc:
            bal_rows.append({"product_id": loc, "company_id": cid, "date": "2026-09-01 00:00:00", "balance": round(loc_bal, 2), "available": None, "granted": None, "liquidity": None, "countable": None})
    groups.to_csv(out / "groups.csv", index=False)
    pd.DataFrame(comp_rows).to_csv(out / "companies.csv", index=False)
    pd.DataFrame(prod_rows).to_csv(out / "banking_products.csv", index=False)
    pd.DataFrame(debt_rows).to_csv(out / "debt_products.csv", index=False)
    pd.DataFrame(sched_rows).to_csv(out / "debt_schedule_config.csv", index=False)
    pd.DataFrame(bal_rows).to_csv(out / "balances.csv", index=False)
    pd.DataFrame(tx_rows).to_csv(out / "transactions.csv", index=False)
    pd.DataFrame(inv_rows).to_csv(out / "invoices.csv", index=False)


if __name__ == "__main__":
    make(Path(sys.argv[1]), int(sys.argv[2]) if len(sys.argv) > 2 else 48)
