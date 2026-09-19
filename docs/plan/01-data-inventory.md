# 01 · Data Inventory

Responsable: **Felipe** (mantenimiento). Números: [08-data-quality-report.md](08-data-quality-report.md).
Definiciones de columnas crudas: [../data_dictionary.md](../data_dictionary.md) (entregable nº 2).

> Adaptación: el plan habla de "usuario"; en este reto la unidad es la **empresa** (1.286 pymes,
> 250 grupos). Los factores tipo FICO son de crédito al consumo; aquí se reinterpretan para empresa.

## Clases

| Clase | Significado | Regla |
|---|---|---|
| **OBSERVED** | Columna tal cual de un CSV | Se usa con su nota de calidad |
| **DERIVED** | Cálculo determinista sobre OBSERVED | Fórmula en [03-feature-catalog.md](03-feature-catalog.md) |
| **ESTIMATED** | Aproximación con supuestos (proxy, cota) | Se etiqueta como estimación en código, API y demo |
| **SYNTHETIC** | Generado por nosotros para test/desarrollo | Nunca se mezcla con datos reales ni se enseña como real |
| **MISSING** | No lo tenemos | No se inventa. Va a [05-source-map.md](05-source-map.md) |

Todo el dataset del reto es sintético *de origen* (lo genera Embat a partir de distribuciones reales);
para nosotros es el dato "real" (OBSERVED). SYNTHETIC se reserva para lo que generemos nosotros
(p. ej. el mock del front de `main`, `frontend/src/api/mock/`).

## Reglas duras que salen de la auditoría

1. **`balances.csv` y `debt_products.granted/outstanding` son fotos a 2026-09-01.** Usarlas como
   feature de un mes pasado es fuga de información. Las series mensuales se reconstruyen: saldo(T) =
   saldo(corte) − Σ movimientos posteriores a T.
2. **`invoices.status` y `pending_amount` son estado a fecha de corte.** El estado en T se reconstruye
   con fechas. En facturas no pagadas, `payment_date` es un marcador (= `due_date` en el 96 %), no un pago.
3. **`created_at` (empresas y productos) es la fecha de alta en la plataforma**, no de constitución
   ni de apertura. Es una cota inferior de antigüedad, nunca la antigüedad.
4. **Concentración de contrapartes: solo con `invoices`** (98,7 % con contraparte). En `transactions`
   el 90,2 % no tiene contraparte resuelta.
5. **Split por `group_id`**: el 94,5 % de las empresas está en un grupo de ≥ 2.
6. **Historia corta**: mediana de 19 meses con movimientos, p25 = 10. Toda feature necesita
   `min_periods` y un indicador de meses observados.

## Inventario

Leyenda "Modelo": **V0** = entra en el score baseline · **V1** = candidata, se prueba en FASE 4-5 ·
**No** = no entra (motivo en "Calidad") · **Conf.** = no puntúa, modula la confianza del score.

### A. Historial de pagos (FICO 35 %)

| Variable | Clase | Fuente | Tipo | ¿Calculable? / cómo | Calidad | Modelo |
|---|---|---|---|---|---|---|
| Facturas a pagar pagadas a tiempo / con retraso | DERIVED | `invoices` (`amount<0`, `status=paid`) | conteo, % | DPD = `payment_date − due_date` | 410 k facturas, 60,9 % empresas | V0 |
| Días de retraso: medio, p90, máximo | DERIVED | idem | días | agregación por ventana | idem; mediana DPD = 0, p90 = 28 | V0 |
| Nº de retrasos > 30 días | DERIVED | idem | conteo | DPD > 30 en la ventana | 8,9 % de las pagadas | V1 |
| Facturas a pagar vencidas y abiertas en T | DERIVED | `invoices` (fechas) | importe, % | abierta si no pagada en T y `due_date < T` | point-in-time; ver regla 2 | V0 |
| Evolución de los retrasos (pendiente) | DERIVED | idem | días/mes | OLS del DPD mensual, 6 m | requiere ≥ 3 meses | V0 |
| Puntualidad de nóminas | DERIVED | `transactions.category = salary` | días, % meses | día de pago y meses con pago | 63,7 % empresas | V1 |
| Puntualidad Seguridad Social / impuestos | DERIVED | `category ∈ {social_security, tax}` | % meses, importe | regularidad y desplazamiento | 53,3 % / 89,8 % empresas | V1 |
| Recibos devueltos (cobros y pagos) | DERIVED | `category ∈ {collection_refund, payment_refund}` | tasa | devoluciones / movimientos | 33-35 % empresas | V1 |
| Regularidad de cuotas de deuda | DERIVED | `category = debt_repayment` | % meses | meses con cuota / meses activos | 40,8 % empresas | V1 |
| Pago según cuadro de amortización | DERIVED | `debt_schedule_config` | — | cuota esperada vs pagada | solo 40 empresas (3,1 %) | No |
| Cuentas en recobro | MISSING | — | — | proxy ESTIMATED: facturas a pagar vencidas > 90 días | el proxy mezcla impago e higiene del ERP (mediana 185 días vencida) | V1 (proxy) |
| Impagos formales / defaults | MISSING | — | — | no hay campo; ver source map (CIRBE, ficheros de morosidad, concursos) | — | No |

### B. Deuda y utilización (FICO 30 %)

| Variable | Clase | Fuente | Tipo | ¿Calculable? / cómo | Calidad | Modelo |
|---|---|---|---|---|---|---|
| Deuda concedida total | OBSERVED | `debt_products.granted` | € (foto) | suma por empresa | 92,5 % informado; foto a corte | V1, solo mes de corte |
| Deuda viva total | OBSERVED | `debt_products.outstanding` | € (foto) | suma por empresa | 100 % informado; foto | V1, solo mes de corte |
| Límite de línea de crédito | OBSERVED | `granted` de `lineofcredit` | € | se asume constante en 24 m (supuesto) | 85,4 % no cero | V1 |
| Dispuesto mensual de línea de crédito | DERIVED | foto + movimientos del producto | € | rollback desde `balances` | 311 de 536 líneas tienen movimientos; foto y `outstanding` coinciden solo en el 53 % | V1 |
| Utilización (total, por cuenta, máx, media) | DERIVED | dispuesto / límite | % | ratio; no inventar límite si falta | mediana foto 0,45; > 1 en 4,7 % | V1 |
| Evolución de la utilización | DERIVED | serie anterior | %/mes | OLS 6 m | subconjunto con línea | V1 |
| Deuda revolving vs. a plazos | DERIVED | `debt_products.type` | € | revolving = lineofcredit, card, confirming, factoring; plazos = loan, leasing, mortgage, renting | foto | V1 |
| Servicio de deuda / cobros | DERIVED | `debt_repayment` + `interest_charge` / cobros | ratio | por ventana | 40,8 % y 36,6 % empresas | V0 |
| Coste financiero (intereses + comisiones) / pagos | DERIVED | `interest_charge`, `fee` | ratio | por ventana | fee en 81,6 % | V1 |
| Dispuesto de tarjeta | DERIVED | rollback de productos `card` | € | como líneas de crédito | 184 empresas con movimientos | No (P2) |
| Tipo de interés medio | OBSERVED | `debt_schedule_config` | % | media ponderada | 3,1 % empresas | No |
| Deuda fuera de la plataforma | MISSING | — | € | indicio: 40,8 % paga cuotas pero solo 29,4 % tiene deuda conectada | — | No; ver CIRBE |

### C. Antigüedad del historial (FICO 15 %)

| Variable | Clase | Fuente | Tipo | ¿Calculable? / cómo | Calidad | Modelo |
|---|---|---|---|---|---|---|
| Fecha de constitución de la empresa | MISSING | — | fecha | Registro Mercantil | — | No |
| Antigüedad de la cuenta / producto más antiguo | ESTIMATED | `created_at`, primer movimiento | meses | cota inferior: mín(`created_at`, primer movimiento) | es antigüedad **en la plataforma** | V1 (etiquetada) |
| Antigüedad media / ponderada de productos | ESTIMATED | idem | meses | idem | idem | No |
| Meses de historial observado | DERIVED | `transactions` | meses | meses con movimientos hasta T | mediana 19 | Conf. |
| Relación bancaria más antigua | MISSING | — | — | — | — | No |

### D. Crédito nuevo (FICO 10 %)

| Variable | Clase | Fuente | Tipo | ¿Calculable? / cómo | Calidad | Modelo |
|---|---|---|---|---|---|---|
| Consultas / solicitudes de crédito | MISSING | — | conteo | no existe fuente equivalente para empresas en España | — | No |
| Nuevos productos de deuda en 3/6 m | ESTIMATED | primer movimiento del producto | conteo | conexión ≠ apertura | 17,5 % productos conectados antes del histórico | No (P2) |
| Nuevas relaciones bancarias | ESTIMATED | `bank_name` + primer movimiento | conteo | idem | idem | No (P2) |
| Aumentos de límite | MISSING | `granted` es foto | — | — | — | No |

### E. Combinación de productos (FICO 10 %)

| Variable | Clase | Fuente | Tipo | ¿Calculable? / cómo | Calidad | Modelo |
|---|---|---|---|---|---|---|
| Nº y tipos de productos bancarios y de deuda | OBSERVED | `banking_products`, `debt_products` | conteo | en T: solo productos con movimientos ≤ T | 29,4 % tiene deuda | V1 |
| Nº de bancos distintos | OBSERVED | `bank_name` | conteo | excluir `Other (customer-defined)` | — | V1 |
| Usa factoring / confirming | OBSERVED | `type` | bool | — | 70 y 19 empresas; signo ambiguo (tensión o sofisticación) | V1 (hipótesis H11) |
| Avales (`guarantee`) | OBSERVED | `type` | bool, € | — | 51 empresas | No (P2) |

### F. Liquidez y caja (no está en FICO; es lo que Embat sí ve)

| Variable | Clase | Fuente | Tipo | ¿Calculable? / cómo | Calidad | Modelo |
|---|---|---|---|---|---|---|
| Saldo de caja a fin de mes | DERIVED | `balances` (ancla) + `transactions` | € | rollback de cuentas `checking` | 1.261 empresas; 8,3 % empresa-mes < 0 | V0 |
| Meses de gasto cubiertos / días de caja | DERIVED | caja / pagos medios | meses | por ventana | idem | V0 |
| Volatilidad del saldo | DERIVED | serie de caja | ratio | std 6 m / gasto medio | idem | V0 |
| Meses en descubierto, mínimo de caja | DERIVED | idem | conteo, € | ventana 6 m | idem | V1 |
| Cobros / pagos del mes | DERIVED | `transactions.amount` por signo | € | `transfer` (5,9 %) se separa: puede ser intragrupo (supuesto a verificar, T1.2) | 100 % empresas | V0 |

### G. Ingresos, cobro y actividad (no está en FICO)

| Variable | Clase | Fuente | Tipo | ¿Calculable? / cómo | Calidad | Modelo |
|---|---|---|---|---|---|---|
| Ingresos (cobros operativos) | DERIVED | `category ∈ {collection, bulk_collection, pos_settlement, cash_settlement}` | € | suma mensual | son **cobros bancarios**, no ingresos contables | V0 |
| Estabilidad de ingresos | DERIVED | idem | CV | std/media 6 m | idem | V1 |
| DSO | DERIVED | `invoices` (`amount>0`) | días | ver catálogo | 57,7 % empresas | V0 |
| DPO | DERIVED | `invoices` (`amount<0`) | días | ver catálogo | 60,9 % empresas | V1 |
| CCC = DSO − DPO | DERIVED | idem | días | sin DIO (inventario MISSING) | idem | V1 |
| Cobros vencidos abiertos en T | DERIVED | `invoices` (fechas) | % | point-in-time | 27,4 % de las emitidas acaba `overdue` | V0 |
| Concentración de clientes / proveedores | DERIVED | `invoices.counterparty_id` | HHI, top-1, top-3 | por lado y ventana | 98,7 % con contraparte | V1 |
| Rotación de clientes | DERIVED | idem | % | clientes perdidos en 3 m | idem | V1 |
| Nivel de actividad / cese | DERIVED | `transactions` | conteo, meses sin actividad | — | 9,4 % empresas sin movimientos desde antes de 2026-08 | V1 (y proxy de desenlace) |
| Masa salarial y su tendencia | DERIVED | `category = salary` | € | — | 63,7 % empresas; signo ambiguo | No (P2) |

### H. Contexto

| Variable | Clase | Fuente | Tipo | ¿Calculable? / cómo | Calidad | Modelo |
|---|---|---|---|---|---|---|
| Grupo y tamaño del grupo | OBSERVED | `companies.group_id` | id, conteo | — | 94,5 % en grupo ≥ 2 | V1 |
| Salud de las empresas hermanas | DERIVED | score del resto del grupo, mes anterior | 0-100 | excluyendo la propia | riesgo de fuga si el grupo cruza el split | V1 (H7) |
| Sector (CNAE) | **MISSING** | — | — | no existe en ningún fichero | el front no puede mostrar sector real | No |
| País | OBSERVED | `companies.country` | ISO | — | 82,1 % vacío | No |
| Tamaño | ESTIMATED | volumen de pagos 12 m | cuartil | proxy, no facturación contable | — | Conf. / cohortes |
| Moneda | OBSERVED | `currency`, `exchange_rate` | — | normalizar importes | 4-5 % con divisa ≠ contable | Normalización |
| ERP | OBSERVED | `companies.erp` | categoría | — | 42,1 % vacío | V1 (calidad) |

### I. Calidad del dato como señal

| Variable | Clase | Fuente | Tipo | ¿Calculable? / cómo | Calidad | Modelo |
|---|---|---|---|---|---|---|
| % movimientos conciliados | DERIVED | `accounting_status` | % | por ventana | 61,6 % vacío | V1 (hipótesis) |
| % movimientos sin categoría | DERIVED | `category == '-'` | % | por ventana | 24,9 % de los movimientos | V1 (hipótesis) |
| Facturas vencidas > 365 días abiertas | DERIVED | `invoices` | conteo | — | posible higiene del ERP, no impago (H13) | V1 (hipótesis) |

### J. Desenlace (target)

| Variable | Clase | Fuente | Calidad | Uso |
|---|---|---|---|---|
| Quiebra / impago / cierre | MISSING | — | no existe en el dataset | — |
| Ground truth del leaderboard (test oculto) | MISSING | organización (script de scoring) | formato y métrica sin confirmar | **P0**: pedirlo |
| Proxies de desenlace O1-O5 | ESTIMATED | construidos en [06-model-spec.md](06-model-spec.md) | asunción propia | validación interna, declarada en la demo |

## Columnas auditadas y descartadas

| Columna | Motivo |
|---|---|
| `balances.available` | 100 % vacía |
| `balances.countable`, `liquidity` | 92 % y 76 % vacías |
| `transactions.value_date − date` | ≈ 0 días en casi todas las empresas |
| `transactions.status = pending` | 0,3 % de los movimientos |
| `companies.erp` vs `groups.erp` | difieren en el 67 %: ruido del generador |
