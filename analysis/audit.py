"""FASE 0 — Auditoría de datos. Genera docs/plan/08-data-quality-report.md.

Uso:  python analysis/audit.py [DATA_DIR] > docs/plan/08-data-quality-report.md
DATA_DIR por defecto: data/raw
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd

D = Path(sys.argv[1] if len(sys.argv) > 1 else "data/raw")
SNAP = pd.Timestamp("2026-09-01")
out = []


def p(line=""):
    out.append(line)


def pct(x):
    return f"{100 * x:.1f} %"


def table(df):
    df = df.reset_index()
    p("| " + " | ".join(map(str, df.columns)) + " |")
    p("|" + "---|" * len(df.columns))
    for r in df.itertuples(index=False):
        p("| " + " | ".join("" if pd.isna(v) else str(v) for v in r) + " |")
    p()


def read(name, **kw):
    return pd.read_csv(D / f"{name}.csv", **kw)


comp = read("companies", parse_dates=["created_at"])
grp = read("groups")
bank = read("banking_products", parse_dates=["created_at"])
debt = read("debt_products", parse_dates=["created_at"])
sched = read("debt_schedule_config", parse_dates=["next_payment_date", "last_payment_date"])
bal = read("balances", parse_dates=["date"])
tx = read("transactions", usecols=["company_id", "product_id", "date", "amount", "exchange_rate", "status",
                                   "accounting_status", "category", "counterparty_id"], parse_dates=["date"])
inv = read("invoices", usecols=["company_id", "document_type", "issuance_date", "due_date", "payment_date", "amount",
                                "pending_amount", "currency", "accounting_currency", "status", "counterparty_id"],
           parse_dates=["issuance_date", "due_date", "payment_date"])
N = len(comp)

p("# 08 · Data Quality Report (FASE 0)")
p()
p("Generado por `python analysis/audit.py data/raw`. Todos los números salen de los CSV, no del diccionario.")
p(f"Corte de datos: {SNAP.date()}. Empresas: {N:,}. Grupos: {len(grp):,}.")
p()

# ---------------------------------------------------------------- volumen
p("## 1. Volumen y rango temporal")
p()
rows = [("companies", len(comp), comp.created_at.min(), comp.created_at.max()),
        ("banking_products", len(bank), bank.created_at.min(), bank.created_at.max()),
        ("debt_products", len(debt), debt.created_at.min(), debt.created_at.max()),
        ("debt_schedule_config", len(sched), sched.last_payment_date.min(), sched.next_payment_date.max()),
        ("balances", len(bal), bal.date.min(), bal.date.max()),
        ("transactions", len(tx), tx.date.min(), tx.date.max()),
        ("invoices", len(inv), inv.issuance_date.min(), inv.issuance_date.max())]
table(pd.DataFrame(rows, columns=["fichero", "filas", "fecha mín", "fecha máx"]).set_index("fichero"))

# ---------------------------------------------------------------- nulos
p("## 2. Nulos por columna (solo columnas con nulos)")
p()
for name, df in [("companies", comp), ("banking_products", bank), ("debt_products", debt),
                 ("debt_schedule_config", sched), ("balances", bal), ("transactions", tx), ("invoices", inv)]:
    nn = df.isna().mean()
    nn = nn[nn > 0].sort_values(ascending=False)
    if len(nn):
        p(f"**{name}**: " + ", ".join(f"`{c}` {pct(v)}" for c, v in nn.items()))
        p()

# ---------------------------------------------------------------- cobertura por empresa
p("## 3. Cobertura por empresa (qué % de las 1.286 empresas tiene cada fuente)")
p()
active = tx.assign(m=tx.date.dt.to_period("M")).groupby("company_id").m.nunique()
cov = {
    "con transacciones": tx.company_id.nunique() / N,
    "con ≥ 20 meses con movimientos": (active >= 20).sum() / N,
    "con facturas (ERP conectado)": inv.company_id.nunique() / N,
    "con facturas a pagar (amount<0)": inv[inv.amount < 0].company_id.nunique() / N,
    "con facturas a cobrar (amount>0)": inv[inv.amount > 0].company_id.nunique() / N,
    "con algún producto de deuda": debt.company_id.nunique() / N,
    "con línea de crédito": debt[debt.type == "lineofcredit"].company_id.nunique() / N,
    "con préstamo/leasing/hipoteca": debt[debt.type.isin(["loan", "leasing", "mortgage"])].company_id.nunique() / N,
    "con cuadro de amortización (schedule)": sched.company_id.nunique() / N,
    "con tarjeta": bank[bank.type == "card"].company_id.nunique() / N,
    "con país informado": comp.country.notna().mean(),
    "con ERP informado": comp.erp.notna().mean(),
    "en grupo de ≥ 2 empresas": comp.group_id.map(comp.group_id.value_counts()).ge(2).mean(),
}
table(pd.DataFrame({"cobertura": {k: pct(v) for k, v in cov.items()}}).rename_axis("fuente"))
tx["m"] = tx.date.dt.to_period("M")
span = tx.groupby("company_id").m.agg(["min", "max", "nunique"])
q = span["nunique"].quantile([.1, .25, .5, .75]).tolist()
p(f"- Meses con movimientos por empresa: p10 {q[0]:.0f}, p25 {q[1]:.0f}, mediana {q[2]:.0f}, p75 {q[3]:.0f} (de 25 posibles). "
  "Las ventanas de 12 meses no existen para una parte grande de la cartera.")
p("- Primer mes con movimientos (olas de alta): " + ", ".join(f"{k} → {v}" for k, v in span["min"].value_counts().head(4).items()))
p(f"- Empresas cuyo último movimiento es anterior a 2026-08: {pct((span['max'] < pd.Period('2026-08', 'M')).mean())} "
  "(¿cese, desconexión o baja de la plataforma? no se distingue con estos datos).")
p()

# ---------------------------------------------------------------- productos
p("## 4. Productos")
p()
t = pd.concat([bank.type.value_counts().rename("n").to_frame().assign(tabla="banking"),
               debt.type.value_counts().rename("n").to_frame().assign(tabla="debt")])
t["empresas"] = pd.concat([bank, debt]).groupby("type").company_id.nunique().reindex(t.index)
table(t.rename_axis("type"))
g = debt.groupby("type").agg(n=("product_id", "size"),
                             granted_informado=("granted", lambda s: pct(s.notna().mean())),
                             granted_no_cero=("granted", lambda s: pct((s.fillna(0).abs() > 1).mean())),
                             outstanding_informado=("outstanding", lambda s: pct(s.notna().mean())),
                             liquidity_informado=("liquidity", lambda s: pct(s.notna().mean())))
p("Calidad de `granted` / `outstanding` en `debt_products` (foto única, una fila por producto):")
p()
table(g.rename_axis("type"))
p(f"`created_at` de productos = fecha de **conexión a la plataforma**, no de apertura. "
  f"El {pct((pd.concat([bank, debt]).created_at < '2024-09-01').mean())} de los productos se conectó antes del inicio del histórico.")
p()

# ---------------------------------------------------------------- transacciones
p("## 5. Transacciones")
p()
ptype = pd.concat([bank[["product_id", "type"]], debt[["product_id", "type"]]]).set_index("product_id").type
tx["ptype"] = tx.product_id.map(ptype)
p("Movimientos por tipo de producto (¿se puede reconstruir el saldo dispuesto de la deuda?):")
p()
table(tx.groupby("ptype").agg(movimientos=("amount", "size"), empresas=("company_id", "nunique")).sort_values("movimientos", ascending=False))
p("Categorías (`category`):")
p()
c = tx.category.fillna("(vacía)").value_counts()
table(pd.DataFrame({"movimientos": c, "%": (c / len(tx)).map(pct)}).rename_axis("category"))
p(f"- `category == '-'` (sin categorizar, no es un nulo): {pct((tx.category == '-').mean())}")
p(f"- `status`: " + ", ".join(f"{k} {pct(v)}" for k, v in tx.status.value_counts(normalize=True).items()))
p(f"- `accounting_status` vacío: {pct(tx.accounting_status.isna().mean())}")
p(f"- sin contraparte resuelta: {pct(tx.counterparty_id.isna().mean())}")
p(f"- `exchange_rate` ≠ 1: {pct((tx.exchange_rate.fillna(1) != 1).mean())}")
p()

# ---------------------------------------------------------------- facturas
p("## 6. Facturas (materia prima del historial de pagos)")
p()
inv["lado"] = np.where(inv.amount < 0, "a pagar", np.where(inv.amount > 0, "a cobrar", "cero"))
st = pd.crosstab(inv.status, inv.lado, normalize="columns").map(pct)
table(st)
paid = inv[(inv.status == "paid") & inv.payment_date.notna() & inv.due_date.notna()].copy()
paid["dpd"] = (paid.payment_date - paid.due_date).dt.days
paid["plazo"] = (paid.payment_date - paid.issuance_date).dt.days
d = paid.groupby("lado").agg(facturas=("dpd", "size"), dpd_medio=("dpd", "mean"), dpd_p50=("dpd", "median"),
                             dpd_p90=("dpd", lambda s: s.quantile(.9)), pct_dpd_gt30=("dpd", lambda s: pct((s > 30).mean())),
                             pct_antes_vto=("dpd", lambda s: pct((s < 0).mean())), dias_emision_a_pago=("plazo", "median"))
p("Retraso real sobre facturas pagadas (DPD = `payment_date − due_date`, días):")
p()
table(d.round(1))
p("**`payment_date` solo es un pago real cuando `status == 'paid'`.** En facturas abiertas es un marcador:")
p()
for s in ["overdue", "pending"]:
    o = inv[inv.status == s]
    dd = (SNAP - o.due_date).dt.days.quantile([.5, .9]).tolist()
    p(f"- `{s}` ({len(o):,}): `payment_date == due_date` en {pct((o.payment_date == o.due_date).mean())}, "
      f"`pending_amount` > 0 en {pct((o.pending_amount.abs() > 0).mean())}; días vencida a fecha de corte: mediana {dd[0]:.0f}, p90 {dd[1]:.0f}.")
p(f"- `paid` con `payment_date` posterior al corte: {pct((inv[inv.status == 'paid'].payment_date > SNAP).mean())} (anomalía a filtrar).")
p("- `status` y `pending_amount` son el estado **a fecha de corte**. Usarlos tal cual como feature de un mes pasado es "
  "fuga de información. El estado en el mes T se reconstruye: abierta en T si `issuance_date ≤ T` y "
  "(`status != 'paid'` o `payment_date > T`); vencida en T si además `due_date < T`.")
p(f"- `due_date` vacío: {pct(inv.due_date.isna().mean())}")
p(f"- `currency` ≠ `accounting_currency`: {pct((inv.currency != inv.accounting_currency).mean())}")
p(f"- sin contraparte: {pct(inv.counterparty_id.isna().mean())}")
p()
dt = inv.document_type.value_counts()
table(pd.DataFrame({"facturas": dt, "%": (dt / len(inv)).map(pct)}).rename_axis("document_type"))

# ---------------------------------------------------------------- deuda
p("## 7. Cuadros de amortización")
p()
p(f"- {len(sched)} préstamos con cuadro, de {sched.company_id.nunique()} empresas ({pct(sched.company_id.nunique() / N)}).")
p(f"- `next_payment_date` anterior al corte: {pct((sched.next_payment_date < SNAP).mean())}")
p(f"- `interest_type`: " + ", ".join(f"{k} {v}" for k, v in sched.interest_type.value_counts().items()))
p()

# ---------------------------------------------------------------- saldos
p("## 8. Saldos (`balances.csv`)")
p()
p(f"- Fecha: {pct((bal.date == SNAP).mean())} de filas a {SNAP.date()}; el resto, días antes. **Es una foto, no una serie.**")
sent = bal.balance.abs() >= 1e8
p(f"- `|balance|` ≥ 1e8 (valores centinela/anómalos, excluir): {int(sent.sum())} filas")
allp = pd.concat([bank[["product_id", "type"]], debt[["product_id", "type"]]])
p(f"- Productos con fila en `balances`: {pct(allp.product_id.isin(bal.product_id).mean())}")
p()

# ---------------------------------------------------------------- reconstrucción de series
p("## 9. ¿Se pueden reconstruir series mensuales? (ancla en la foto + movimientos hacia atrás)")
p()
p("`saldo(fin de T) = saldo(corte) − Σ amount de movimientos posteriores a T`. Supuesto: todos los movimientos "
  "de la cuenta están en `transactions.csv`. Antes del primer movimiento de la cuenta la serie no es fiable (enmascarar).")
p()
months = pd.period_range("2024-09", "2026-09", freq="M")


def rollback(pids):
    b = bal[~sent].set_index("product_id").balance
    t = tx[tx.product_id.isin(pids) & tx.product_id.isin(b.index)]
    f = t.groupby(["product_id", "m"]).amount.sum().unstack(fill_value=0).reindex(columns=months, fill_value=0)
    after = f.iloc[:, ::-1].cumsum(axis=1).iloc[:, ::-1].shift(-1, axis=1).fillna(0)
    return (-after).add(b.reindex(f.index), axis=0)


chk = rollback(bank.loc[bank.type == "checking", "product_id"])
cash = chk.groupby(bank.set_index("product_id").company_id.reindex(chk.index)).sum()
p(f"- Caja (cuentas `checking`): {len(chk):,} cuentas con movimientos y foto; {len(cash):,} empresas. "
  f"Empresa-mes con caja total < 0: {pct((cash < 0).mean().mean())}.")
loc = debt[debt.type == "lineofcredit"]
lr = rollback(loc.product_id)
b2 = bal.set_index("product_id").balance.reindex(loc.product_id)
p(f"- Líneas de crédito: {len(lr)} de {len(loc)} con movimientos → serie de dispuesto reconstruible solo para esas. "
  f"`balances.balance` coincide con `debt_products.outstanding` en {pct(np.isclose(b2.values, loc.outstanding.values).mean())} "
  "(dos fotos que no siempre cuadran: marcar calidad).")
u = (loc.outstanding.abs() / loc.granted.abs()).replace(np.inf, np.nan)
p(f"- Utilización en la foto (|outstanding| / |granted|): mediana {u.median():.2f}, > 1 en {pct((u > 1).mean())}.")
p()

# ---------------------------------------------------------------- grupos
p("## 10. Grupos (riesgo de leakage en el split)")
p()
gs = comp.group_id.value_counts()
p(f"- Tamaño de grupo: mediana {int(gs.median())}, máx {int(gs.max())}; {int((gs == 1).sum())} grupos de una sola empresa.")
p(f"- El split train/validación debe hacerse **por `group_id`**, no por empresa.")

print("\n".join(out))
