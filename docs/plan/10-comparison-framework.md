# 10 · Comparison Framework

Responsable: **Yo**. Comparación **descriptiva**: no afirma que nuestro enfoque sea mejor. Eso solo lo
dice la validación (09, T6.1).

Referencias tradicionales: el reparto de categorías de FICO (35/30/15/10/10, publicado por FICO; el
modelo interno es propietario) y, para empresas, el **Altman Z-Score** (1968: suma ponderada de ratios de
balance). Altman no se puede calcular aquí: las cuentas anuales son MISSING (05).

## Matriz 1 · Factor tradicional → datos

| Factor tradicional | Tenemos (OBSERVED) | Podemos derivar (DERIVED) | Faltan (MISSING) | Nuevas propuestas |
|---|---|---|---|---|
| Historial de pagos (35 %) | fechas de emisión, vencimiento y pago de 898 k facturas; categorías de movimientos | DPD, vencidas abiertas en T, tendencia de retrasos, puntualidad de nóminas / SS / impuestos, devoluciones | impagos formales, recobro, morosidad en bureaus | orden de prelación (H6), bache vs caída (H8) |
| Deuda y utilización (30 %) | concedido y vivo por producto (foto) | dispuesto mensual de líneas (311 de 536), servicio de deuda, coste financiero | deuda fuera de la plataforma, histórico de límites | servicio de deuda sobre cobros reales (H2) |
| Antigüedad (15 %) | alta en la plataforma | cota inferior de antigüedad, meses observados | fecha de constitución, apertura de cuentas | meses observados como **confianza** del score, no como puntos |
| Crédito nuevo (10 %) | — | nuevos productos con movimientos (estimado) | consultas de crédito (no obtenibles) | — |
| Mix (10 %) | tipos de producto, bancos | revolving vs a plazos | — | factoring/confirming como señal a probar (H11) |

## Matriz 2 · Dimensión → enfoque

| Dimensión | Scoring tradicional | Nuestro enfoque |
|---|---|---|
| Historial | incidencias de impago declaradas | retraso real factura a factura, mes a mes |
| Utilización | saldo / límite en la fecha del informe | serie mensual reconstruida donde hay movimientos |
| Antigüedad | años de historial crediticio | no disponible; se usa como confianza |
| Crédito nuevo | consultas y aperturas recientes | no disponible |
| Mix | tipos de crédito | tipos de producto conectados |
| Tendencia | poca o ninguna (foto) | pendiente de cada métrica y del score (`trajectory`) |
| Liquidez | no entra | caja reconstruida, cobertura, volatilidad |
| Capacidad de pago | ingresos declarados | cobros observados frente a servicio de deuda |
| Comportamiento temporal | frecuencia de actualización baja | mensual; bache vs caída; momentum |
| Relaciones entre variables | implícitas en el modelo | hipótesis explícitas H1-H13, cada una medida |
| Frecuencia | trimestral o anual (cuentas) | mensual |
| Dirección | mide riesgo de impago | mide salud en las dos direcciones (mejora y deterioro) |

## Dónde podemos diferenciarnos (a demostrar, no a afirmar)

| Oportunidad | Base en datos | Cómo se demuestra |
|---|---|---|
| Dinámica temporal | 24 meses de movimientos y facturas | `trajectory` aporta sobre `level` (06 §6) |
| Relaciones | H1-H5 | protocolo de 04 |
| Capacidad financiera | servicio de deuda / cobros, cobertura de caja | H2 |
| Resiliencia y recuperación | M4 | tasa y tiempo de recuperación tras caídas |
| Consistencia | M3 | estabilidad: % de falsos baches |
| Personalización | M5 (contra su propia historia) | H9 |
| Anticipación | H6 (prelación), H10 (devoluciones) | meses de adelanto medidos |
