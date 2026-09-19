# 03 · Feature Catalog

Responsable: **Yo** (diseño e implementación RAW → FEATURES). Diego decide qué entra (CAPA 3).

## Tres capas

| Capa | Qué es | Dónde vive |
|---|---|---|
| 1 · RAW | Los 9 CSV, tipados, sin tocar | `data/raw/` → `data/interim/*.parquet` (T1.1) |
| 2 · FEATURES | Panel `(company_id, T)` con todo lo de este catálogo | `data/features/panel.parquet` (T2.1) |
| 3 · MODEL FEATURES | Subconjunto que entra al score | lista versionada en [06-model-spec.md](06-model-spec.md) |

## Convenciones

- **T** = mes de cálculo. Toda feature de la fila `(empresa, T)` usa solo datos con fecha ≤ último día de T.
- Ventanas `w ∈ {3, 6, 12}` meses, incluido T. `min_periods`: 2 para w=3, 3 para w=6, 6 para w=12; si no se cumple → vacío (no 0).
- **Pendiente** = OLS del valor mensual sobre los últimos 6 meses (≥ 3 puntos). Nunca diferencia punta a punta.
- **Signo**: columna "↑ es" dice si subir es bueno (+) o malo (−). Ambiguo (±) = no entra hasta probarlo.
- Importes en moneda contable de la empresa; `exchange_rate` solo al comparar empresas entre sí (T1.3).
- **Fuga**: ninguna feature usa `invoices.status`, `pending_amount`, `balances.*` ni `debt_products.granted/outstanding` directamente en un T < corte. Test obligatorio T2.3.
- "Tiempo real" = se puede calcular el día del scoring con lo que Embat recibe (movimientos y facturas del ERP). Todo lo de este catálogo lo es salvo lo marcado "solo corte".

## Agregados base (mensuales, capa 2 intermedia)

| Agregado | Fórmula |
|---|---|
| `cash_eom` | Σ cuentas `checking`: saldo(corte) − Σ `amount` con fecha > fin de T. Vacío antes del primer movimiento de la cuenta |
| `inflow_op` | Σ `amount > 0` con `category ∈ {collection, bulk_collection, pos_settlement, cash_settlement}` |
| `outflow_op` | −Σ `amount < 0` excluyendo `transfer`, `investment_deployment` |
| `debt_service` | −Σ `amount` con `category ∈ {debt_repayment, interest_charge}` |
| `inv_open_due(T, lado)` | Σ importe de facturas con `issuance_date ≤ T`, `due_date < T` y (`status ≠ paid` o `payment_date > T`) |
| `inv_issued(T, w, lado)` | Σ importe de facturas con `issuance_date` en la ventana |
| `dpd_paid(T, w, lado)` | DPD = `payment_date − due_date` de facturas `paid` con `payment_date` en la ventana |
| `loc_drawn` | rollback de productos `lineofcredit` (como `cash_eom`), en valor absoluto |

Lado: **pagar** = `amount < 0`; **cobrar** = `amount > 0`.

## Catálogo

| ID | Nombre | Definición / fórmula | Ventana | ↑ es | Riesgos | Fuga | Modelo |
|---|---|---|---|---|---|---|---|
| **Pago (A)** |||||||
| F01 | `pay_overdue_open_ratio` | `inv_open_due(T, pagar)` / `inv_issued(T, 12, pagar)` | 12 m | − | facturas muy antiguas por higiene del ERP (H13) | reconstruido en T | V0 |
| F02 | `pay_dpd_mean` | DPD medio ponderado por importe, facturas a pagar pagadas | 3 m | − | pocas facturas → ruido; exigir ≥ 5 | no | V0 |
| F03 | `pay_late30_share` | % facturas a pagar pagadas con DPD > 30 | 6 m | − | idem | no | V1 |
| F04 | `pay_dpd_slope` | pendiente de F02 mensual | 6 m | − | historia corta | no | V0 |
| F05 | `payroll_regularity` | meses con `salary` / meses activos; desplazamiento del día de pago vs mediana 12 m | 6 m | + | empresas sin nómina domiciliada | no | V1 |
| F06 | `tax_ss_regularity` | meses con `tax` y `social_security` / meses activos | 6 m | + | calendario fiscal trimestral | no | V1 |
| F07 | `refund_rate` | (`collection_refund` + `payment_refund`) / nº movimientos | 3 m | − | signo de `payment_refund` mixto (69 % positivos) | no | V1 |
| F08 | `months_since_late30` | meses desde la última factura pagada con DPD > 30 | — | + | censurado al inicio de la historia | no | V1 |
| **Cobro e ingresos (G)** |||||||
| F09 | `dso` | media ponderada por importe de (`payment_date` − `issuance_date`) en cobradas; en abiertas en T, (fin de T − `issuance_date`) | 3 m | − | censura en abiertas | reconstruido en T | V0 |
| F10 | `dpo` | ídem sobre facturas a pagar | 3 m | ± | subir puede ser tensión o poder de negociación | reconstruido en T | V1 |
| F11 | `ccc` | F09 − F10 | 3 m | − | sin DIO | idem | V1 |
| F12 | `rec_overdue_open_ratio` | `inv_open_due(T, cobrar)` / `inv_issued(T, 12, cobrar)` | 12 m | − | idem F01 | reconstruido en T | V0 |
| F13 | `inflow_slope` | pendiente de log(1 + `inflow_op`) | 6 m | + | estacionalidad | no | V0 |
| F14 | `inflow_cv` | std / media de `inflow_op` | 6 m | − | — | no | V1 |
| F15 | `inflow_yoy` | `inflow_op` 3 m / mismos 3 m del año anterior | 3 m | + | necesita ≥ 15 meses (solo el 60 % de las empresas) | no | V1 |
| F16 | `client_hhi` | Σ s², s = cuota de cada cliente en facturación emitida | 6 m | − | clientes con una sola factura | no | V1 |
| F17 | `top1_client_share` | máx s | 6 m | − | idem | no | V1 |
| F18 | `client_churn` | % clientes con facturas en [T−12, T−6] sin facturas en [T−2, T] | — | − | negocio por proyectos | no | V1 |
| F19 | `activity_ratio` | nº movimientos 3 m / 12 m (medias) | 3/12 m | + | — | no | V1 |
| F20 | `inactive_months` | meses sin movimientos | 6 m | − | se solapa con proxy O4 (no usar ambos en el mismo experimento) | no | V1 |
| **Liquidez (F)** |||||||
| F21 | `cash_cover` | `cash_eom` / media de `outflow_op` 6 m | — | + | cuentas no conectadas | no | V0 |
| F22 | `cash_min_cover` | mín `cash_eom` 6 m / media `outflow_op` 6 m | 6 m | + | — | no | V1 |
| F23 | `cash_vol` | std(`cash_eom`) / media `outflow_op` | 6 m | − | — | no | V0 |
| F24 | `neg_cash_months` | meses con `cash_eom` < 0 | 6 m | − | — | no | V1 |
| F25 | `io_ratio` | Σ `inflow_op` / Σ `outflow_op` | 3 m | + | pagos de inversión puntuales | no | V0 |
| F26 | `io_ratio_slope` | pendiente de `io_ratio` mensual | 6 m | + | — | no | V0 |
| **Deuda (B)** |||||||
| F27 | `debt_service_ratio` | `debt_service` / `inflow_op` | 3 m | − | deuda no conectada sí aparece aquí (bien) | no | V0 |
| F28 | `fin_cost_ratio` | −Σ (`interest_charge` + `fee`) / `outflow_op` | 6 m | − | — | no | V1 |
| F29 | `loc_util` | `loc_drawn` / Σ `granted` de sus líneas | — | − | solo 311 líneas; límite supuesto constante | rollback | V1 |
| F30 | `loc_util_slope` | pendiente de F29 | 6 m | − | idem | rollback | V1 |
| F31 | `revolving_share` | deuda revolving / deuda total | — | ± | foto | **solo corte** | No (P2) |
| F32 | `leverage` | deuda viva / `inflow_op` 12 m | — | − | foto | **solo corte** | No (P2) |
| **Estructura, antigüedad, mix (C, D, E)** |||||||
| F33 | `history_months` | meses con movimientos hasta T | — | Conf. | — | no | Conf. |
| F34 | `platform_age` | T − mín(`created_at`, primer movimiento) — ESTIMATED | — | + | no es antigüedad crediticia | no | V1 |
| F35 | `n_banks`, `n_debt_types` | en T: productos con movimientos ≤ T | — | ± | — | no | V1 |
| **Grupo (H)** |||||||
| F36 | `sibling_score` | media del score en T−1 del resto del grupo (sin la propia) | — | + | fuga si el grupo cruza el split | no, si split por grupo | V1 (H7) |
| **Calidad del dato (I)** |||||||
| F37 | `reconciled_share` | % movimientos con `accounting_status` conciliado | 3 m | + | 61,6 % vacío | no | V1 |
| F38 | `uncategorized_share` | % movimientos con `category == '-'` | 3 m | − | — | no | V1 |

## Salidas derivadas del score (no son inputs)

| ID | Nombre | Definición |
|---|---|---|
| M1 | `score_slope_3m`, `score_slope_6m` | pendiente del score |
| M2 | `momentum` | `mejorando` si slope 6 m > +u y slope 3 m > 0; `deteriorando` si < −u y slope 3 m < 0; si no `estable` (u se calibra, T3.4) |
| M3 | `persistence` | nº meses consecutivos con Δscore del mismo signo; **caída estructural** si ≥ 3 o si ≥ 2 pilares se mueven en el mismo sentido; si no, **bache** |
| M4 | `recovery_months` | meses hasta recuperar el nivel previo tras una caída ≥ 10 puntos |
| M5 | `self_z` | score de T frente a la media y std de la propia empresa en 12 m (personalización, H9) |

## Interacciones candidatas

Definidas y con protocolo de prueba en [04-relationship-map.md](04-relationship-map.md). Se implementan como
producto de percentiles (p. ej. `pct(F29) × (1 − pct(F04))`) o como segmentación en cuadrantes.
Ninguna entra en V0.
