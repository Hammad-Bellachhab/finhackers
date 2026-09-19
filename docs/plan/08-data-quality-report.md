# 08 · Data Quality Report (FASE 0)

Generado por `python analysis/audit.py data/raw`. Todos los números salen de los CSV, no del diccionario.
Corte de datos: 2026-09-01. Empresas: 1,286. Grupos: 250.

## 1. Volumen y rango temporal

| fichero | filas | fecha mín | fecha máx |
|---|---|---|---|
| companies | 1286 | 2021-11-17 10:55:30 | 2026-07-16 06:51:09 |
| banking_products | 5987 | 2021-11-18 15:54:13 | 2026-09-15 13:36:10 |
| debt_products | 2239 | 2022-04-06 07:26:09 | 2026-09-15 20:50:53 |
| debt_schedule_config | 87 | 2024-02-27 15:09:49 | 2027-01-22 00:00:00 |
| balances | 7996 | 2026-08-25 00:00:00 | 2026-09-01 00:00:00 |
| transactions | 2556437 | 2024-09-01 00:00:00 | 2026-09-01 23:37:04 |
| invoices | 897894 | 2024-09-01 00:00:00 | 2026-09-01 22:00:00 |

## 2. Nulos por columna (solo columnas con nulos)

**companies**: `country` 82.1 %, `erp` 42.1 %

**debt_products**: `liquidity` 64.1 %, `granted` 7.5 %

**balances**: `available` 100.0 %, `countable` 91.7 %, `liquidity` 76.3 %, `granted` 66.9 %

**transactions**: `counterparty_id` 90.2 %, `accounting_status` 61.6 %, `status` 1.2 %, `category` 0.0 %

**invoices**: `counterparty_id` 1.3 %, `due_date` 0.0 %, `payment_date` 0.0 %

## 3. Cobertura por empresa (qué % de las 1.286 empresas tiene cada fuente)

| fuente | cobertura |
|---|---|
| con transacciones | 100.0 % |
| con ≥ 20 meses con movimientos | 46.6 % |
| con facturas (ERP conectado) | 61.0 % |
| con facturas a pagar (amount<0) | 60.9 % |
| con facturas a cobrar (amount>0) | 57.7 % |
| con algún producto de deuda | 29.4 % |
| con línea de crédito | 16.0 % |
| con préstamo/leasing/hipoteca | 20.2 % |
| con cuadro de amortización (schedule) | 3.1 % |
| con tarjeta | 15.9 % |
| con país informado | 17.9 % |
| con ERP informado | 57.9 % |
| en grupo de ≥ 2 empresas | 94.5 % |

- Meses con movimientos por empresa: p10 8, p25 10, mediana 19, p75 24 (de 25 posibles). Las ventanas de 12 meses no existen para una parte grande de la cartera.
- Primer mes con movimientos (olas de alta): 2024-09 → 439, 2026-01 → 132, 2025-01 → 128, 2026-02 → 78
- Empresas cuyo último movimiento es anterior a 2026-08: 9.4 % (¿cese, desconexión o baja de la plataforma? no se distingue con estos datos).

## 4. Productos

| type | n | tabla | empresas |
|---|---|---|---|
| checking | 4854 | banking | 1282 |
| card | 796 | banking | 205 |
| investment | 201 | banking | 94 |
| wallet | 34 | banking | 21 |
| tpv | 25 | banking | 10 |
| risk | 25 | banking | 5 |
| expensesPlatform | 23 | banking | 7 |
| lineofcomex | 19 | banking | 8 |
| saving | 10 | banking | 9 |
| loan | 1022 | debt | 239 |
| lineofcredit | 536 | debt | 206 |
| confirming | 229 | debt | 70 |
| leasing | 179 | debt | 45 |
| guarantee | 155 | debt | 51 |
| mortgage | 60 | debt | 11 |
| renting | 34 | debt | 14 |
| factoring | 24 | debt | 19 |

Calidad de `granted` / `outstanding` en `debt_products` (foto única, una fila por producto):

| type | n | granted_informado | granted_no_cero | outstanding_informado | liquidity_informado |
|---|---|---|---|---|---|
| confirming | 229 | 77.3 % | 75.1 % | 100.0 % | 76.4 % |
| factoring | 24 | 91.7 % | 91.7 % | 100.0 % | 87.5 % |
| guarantee | 155 | 80.0 % | 73.5 % | 100.0 % | 14.2 % |
| leasing | 179 | 98.3 % | 98.3 % | 100.0 % | 5.6 % |
| lineofcredit | 536 | 89.0 % | 85.4 % | 100.0 % | 81.0 % |
| loan | 1022 | 97.8 % | 97.5 % | 100.0 % | 13.8 % |
| mortgage | 60 | 100.0 % | 100.0 % | 100.0 % | 0.0 % |
| renting | 34 | 100.0 % | 97.1 % | 100.0 % | 2.9 % |

`created_at` de productos = fecha de **conexión a la plataforma**, no de apertura. El 17.5 % de los productos se conectó antes del inicio del histórico.

## 5. Transacciones

Movimientos por tipo de producto (¿se puede reconstruir el saldo dispuesto de la deuda?):

| ptype | movimientos | empresas |
|---|---|---|
| checking | 2267795 | 1281 |
| lineofcredit | 182127 | 149 |
| card | 78829 | 184 |
| tpv | 17964 | 8 |
| expensesPlatform | 5077 | 6 |
| wallet | 1766 | 16 |
| confirming | 1444 | 32 |
| factoring | 44 | 3 |
| saving | 39 | 6 |
| lineofcomex | 26 | 3 |
| loan | 12 | 5 |

Categorías (`category`):

| category | movimientos | % |
|---|---|---|
| - | 635530 | 24.9 % |
| collection | 567417 | 22.2 % |
| payment | 362276 | 14.2 % |
| utility | 259430 | 10.1 % |
| fee | 179500 | 7.0 % |
| transfer | 152102 | 5.9 % |
| bulk_collection | 65492 | 2.6 % |
| tax | 55904 | 2.2 % |
| cash_settlement | 48280 | 1.9 % |
| pos_settlement | 47315 | 1.9 % |
| salary | 42223 | 1.7 % |
| bulk_payment | 41469 | 1.6 % |
| social_security | 24158 | 0.9 % |
| debt_repayment | 23044 | 0.9 % |
| cash_withdrawal | 14096 | 0.6 % |
| collection_refund | 11848 | 0.5 % |
| interest_charge | 7822 | 0.3 % |
| pos_withdrawal | 7506 | 0.3 % |
| investment_deployment | 3923 | 0.2 % |
| investment_return | 3458 | 0.1 % |
| payment_refund | 3222 | 0.1 % |
| (vacía) | 330 | 0.0 % |
| cash_settlements | 90 | 0.0 % |
| tax_refund | 2 | 0.0 % |

- `category == '-'` (sin categorizar, no es un nulo): 24.9 %
- `status`: booked 99.7 %, pending 0.3 %
- `accounting_status` vacío: 61.6 %
- sin contraparte resuelta: 90.2 %
- `exchange_rate` ≠ 1: 4.0 %

## 6. Facturas (materia prima del historial de pagos)

| status | a cobrar | a pagar | cero |
|---|---|---|---|
| cancel | 1.2 % | 1.8 % | 9.8 % |
| overdue | 27.4 % | 17.4 % | 0.5 % |
| paid | 67.9 % | 77.4 % | 88.6 % |
| paymentOrder | 0.0 % | 0.0 % | 0.0 % |
| payment_in_progress | 0.0 % | 0.2 % | 0.0 % |
| pending | 3.5 % | 3.2 % | 1.1 % |
| shipped | 0.0 % | 0.0 % | 0.0 % |

Retraso real sobre facturas pagadas (DPD = `payment_date − due_date`, días):

| lado | facturas | dpd_medio | dpd_p50 | dpd_p90 | pct_dpd_gt30 | pct_antes_vto | dias_emision_a_pago |
|---|---|---|---|---|---|---|---|
| a cobrar | 249018 | 11.4 | 0.0 | 37.0 | 12.0 % | 15.3 % | 10.0 |
| a pagar | 410230 | 1.0 | 0.0 | 28.0 | 8.9 % | 13.6 % | 19.0 |
| cero | 1045 | 1.8 | 0.0 | 0.0 | 2.8 % | 1.0 % | 0.0 |

**`payment_date` solo es un pago real cuando `status == 'paid'`.** En facturas abiertas es un marcador:

- `overdue` (192,556): `payment_date == due_date` en 96.3 %, `pending_amount` > 0 en 100.0 %; días vencida a fecha de corte: mediana 185, p90 560.
- `pending` (29,717): `payment_date == due_date` en 98.3 %, `pending_amount` > 0 en 99.9 %; días vencida a fecha de corte: mediana -29, p90 44.
- `paid` con `payment_date` posterior al corte: 3.0 % (anomalía a filtrar).
- `status` y `pending_amount` son el estado **a fecha de corte**. Usarlos tal cual como feature de un mes pasado es fuga de información. El estado en el mes T se reconstruye: abierta en T si `issuance_date ≤ T` y (`status != 'paid'` o `payment_date > T`); vencida en T si además `due_date < T`.
- `due_date` vacío: 0.0 %
- `currency` ≠ `accounting_currency`: 5.0 %
- sin contraparte: 1.3 %

| document_type | facturas | % |
|---|---|---|
| invoice | 760406 | 84.7 % |
| paymentDocument | 53761 | 6.0 % |
| note | 38154 | 4.2 % |
| deposit | 21390 | 2.4 % |
| invoiceGroup | 13775 | 1.5 % |
| deliveryNote | 6380 | 0.7 % |
| refund | 2018 | 0.2 % |
| purchaseOrder | 1259 | 0.1 % |
| other | 739 | 0.1 % |
| cheque | 12 | 0.0 % |

## 7. Cuadros de amortización

- 87 préstamos con cuadro, de 40 empresas (3.1 %).
- `next_payment_date` anterior al corte: 93.1 %
- `interest_type`: fixed 58, variable 29

## 8. Saldos (`balances.csv`)

- Fecha: 99.8 % de filas a 2026-09-01; el resto, días antes. **Es una foto, no una serie.**
- `|balance|` ≥ 1e8 (valores centinela/anómalos, excluir): 17 filas
- Productos con fila en `balances`: 96.9 %

## 9. ¿Se pueden reconstruir series mensuales? (ancla en la foto + movimientos hacia atrás)

`saldo(fin de T) = saldo(corte) − Σ amount de movimientos posteriores a T`. Supuesto: todos los movimientos de la cuenta están en `transactions.csv`. Antes del primer movimiento de la cuenta la serie no es fiable (enmascarar).

- Caja (cuentas `checking`): 4,079 cuentas con movimientos y foto; 1,261 empresas. Empresa-mes con caja total < 0: 8.3 %.
- Líneas de crédito: 311 de 536 con movimientos → serie de dispuesto reconstruible solo para esas. `balances.balance` coincide con `debt_products.outstanding` en 53.0 % (dos fotos que no siempre cuadran: marcar calidad).
- Utilización en la foto (|outstanding| / |granted|): mediana 0.45, > 1 en 4.7 %.

## 10. Grupos (riesgo de leakage en el split)

- Tamaño de grupo: mediana 3, máx 22; 71 grupos de una sola empresa.
- El split train/validación debe hacerse **por `group_id`**, no por empresa.
