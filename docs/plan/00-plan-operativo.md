# 00 · Plan operativo: scoring de salud financiera

## Pregunta central

> ¿Qué información necesitamos para medir de forma fiable la capacidad y el comportamiento financiero de
> cada empresa, qué parte observamos directamente, qué parte podemos derivar de forma válida y qué
> relaciones adicionales podemos **demostrar** que aportan información predictiva?

Unidad: **empresa × mes** (1.286 pymes, 250 grupos, 2024-09 a 2026-09). Reto y dataset: [../reto-embat.md](../reto-embat.md).

## Documentos

| Nº | Entregable | Fichero | Responsable | Estado |
|---|---|---|---|---|
| 1 | Data Inventory | [01-data-inventory.md](01-data-inventory.md) | Felipe | borrador con datos auditados |
| 2 | Data Dictionary | [../data_dictionary.md](../data_dictionary.md) (crudas) + [03](03-feature-catalog.md) (derivadas) | Felipe | crudas: hecho |
| 3 | Feature Catalog | [03-feature-catalog.md](03-feature-catalog.md) | Yo | borrador |
| 4 | Relationship Map | [04-relationship-map.md](04-relationship-map.md) | Yo | hipótesis sin probar |
| 5 | Source Map | [05-source-map.md](05-source-map.md) | Felipe | borrador |
| 6 | Model Specification | [06-model-spec.md](06-model-spec.md) | Diego | borrador para cerrar en T0.4 |
| 7 | Experiment Log | `07-experiment-log.md` | Diego + Yo | se crea en T3.2 |
| 8 | Data Quality Report | [08-data-quality-report.md](08-data-quality-report.md) | Felipe | generado por `analysis/audit.py` |
| 9 | Model Validation Report | `09-model-validation-report.md` | Diego | se crea en T6.1 |
| 10 | Comparison Framework | [10-comparison-framework.md](10-comparison-framework.md) | Yo | borrador |

## Lo que la auditoría ya ha cambiado (leer antes de programar)

1. **No hay desenlace ni sector** en el dataset. El target interno son proxies declarados; la verdad es el leaderboard.
2. **Fotos, no series**: `balances`, `granted`, `outstanding`, `invoices.status`, `pending_amount` son estado a 2026-09-01. Series = foto + movimientos hacia atrás.
3. En facturas no pagadas, **`payment_date` es un marcador**, no un pago.
4. Historia corta (mediana 19 meses, p25 = 10): ventanas con `min_periods` y confianza del score.
5. Split **por grupo**.
6. FICO C y D (antigüedad, crédito nuevo) casi no existen para estas empresas: el peso va a liquidez y cobros.

## Reparto

| Persona | Rol | No hace |
|---|---|---|
| **Felipe** | datos: auditoría, inventario, ingesta, panel base, calidad, fuentes | decidir qué entra al modelo |
| **Yo** | inteligencia de datos: features, relaciones, hipótesis, proxies, analogías, comparación | dar por válida una relación sin probarla |
| **Diego** | modelo: target, split, scorecard, métricas, experimentos, validación | decidir qué datos existen (usa 01 y 03) |
| **Héctor** | front (reverse building) | — consume el contrato de 06 §1 (T3.3) |

## Roadmap

El evento acaba el **2026-09-20**. P0 = imprescindible para la demo y el leaderboard; P1 = suma nota;
P2 = después del hackathon.

| Fase | Objetivo | Tickets | Criterio de salida | Cuándo |
|---|---|---|---|---|
| 0 · Auditoría | saber qué hay y qué no | T0.1-T0.4 | 08 revisado, formato del leaderboard conocido, target cerrado | hoy (casi hecha) |
| 1 · Data pipeline | panel base empresa × mes reproducible | T1.1-T1.4 | `base.parquet` con checks en verde | hoy |
| 2 · Features | capa 2 point-in-time | T2.1-T2.4 | features V0 + test anti-fuga | hoy |
| 3 · Baseline | score V0 servido al front y enviado al leaderboard | T3.1-T3.4 | primera submission + demo con datos reales | hoy / mañana temprano |
| 4 · Relaciones | probar H1-H13, analogías | T4.1-T4.4 | cada hipótesis con decisión en 07 | mañana |
| 5 · Experimentación | V1 solo si gana | T5.1-T5.4 | V1 adoptado o descartado con evidencia | mañana |
| 6 · Validación | números del reto | T6.1-T6.2 | 09 con bidireccionalidad, estabilidad y anticipación | mañana antes del pitch |
| 7 · Producción | reproducible y monitor | T7.1-T7.3 | un comando rehace todo; alertas | P1 mañana / P2 después |

## Tickets

| ID | Resp. | Input | Acción | Output | Depende de | Prio | Hecho cuando |
|---|---|---|---|---|---|---|---|
| **T0.1** | Felipe | `data/raw` | Ejecutar `python analysis/audit.py data/raw` y decidir cada anomalía: 17 saldos centinela, 3 % de `paid` con pago posterior al corte, 53 % de coincidencia `balance`/`outstanding` en líneas, `transfer` | 08 revisado + lista de filtros | — | P0 | cada anomalía tiene decisión escrita (filtrar / mantener / marcar) |
| **T0.2** | Felipe | reto | Preguntar a la organización: formato de submission, métrica del leaderboard, si el test oculto está dentro de las 1.286, si hay fotos históricas de límites | nota en 05 + fichero de ejemplo | — | P0 | el script de scoring acepta un fichero nuestro |
| T0.3 | Yo | 01, 08 | Confirmar con el especialista de datos que `payment_date` es marcador en no pagadas y que la reconstrucción hacia atrás es válida | corrección o confirmación en 01 | T0.1 | P1 | respuesta registrada |
| **T0.4** | Diego | 06 | Cerrar target (O1-O5), periodo etiquetable y métricas | 06 firmado | T0.2 | P0 | sección 2 y 6 de 06 sin "borrador" |
| **T1.1** | Felipe | `data/raw`, T0.1 | CSV → Parquet (duckdb), tipos explícitos, filtros de T0.1, lector CSV real (hay saltos de línea en campos) | `data/interim/*.parquet` + script | T0.1 | P0 | recuentos = 08; descartes contados y registrados |
| **T1.2** | Felipe | T1.1 | Panel base con los agregados de 03 (`cash_eom`, `inflow_op`, `outflow_op`, `debt_service`, `inv_open_due`, `dpd_paid`, `loc_drawn`) | `data/features/base.parquet` | T1.1 | P0 | en T = corte el rollback reproduce la foto; decisión sobre `transfer` escrita |
| T1.3 | Felipe | T1.1 | Regla multimoneda (4-5 % en divisa distinta) | regla en 01 | T1.1 | P1 | documentada y aplicada |
| **T1.4** | Felipe + Diego | `companies` | Split 5 folds por `group_id`, semilla fija; excluir grupos del test oculto si están dentro | `data/splits.csv` | T0.2 | P0 | assert: ningún grupo en dos folds |
| **T2.1** | Yo | T1.2 | Features V0: F01, F02, F04, F09, F12, F13, F21, F23, F25, F26, F27 + F33 | `data/features/panel.parquet` | T1.2 | P0 | cobertura por feature reportada, valores en rango |
| T2.2 | Yo | T2.1 | Features V1 restantes del catálogo | panel ampliado | T2.1 | P1 | idem |
| **T2.3** | Yo | T2.1 | Test anti-fuga: recalcular 50 empresa-mes al azar con datos truncados en T | `test_no_leakage.py` | T2.1 | P0 | assert de igualdad en verde |
| **T2.4** | Yo | T2.1, T1.4 | Tablas de referencia (percentiles y cortes de winsorización) solo con train | `reference_quantiles.parquet` | T1.4 | P0 | una empresa no vista se puntúa sin recalcular referencias |
| **T3.1** | Diego | T2.1, T2.4 | Scorecard V0 según 06 §4 | `scores.parquet` con todos los campos de 06 §1 | T2.4 | P0 | score para toda empresa-mes con ≥ 1 pilar; Σ contribuciones cuadra con el score |
| **T3.2** | Diego | T3.1, T0.2 | Primera submission al leaderboard | entrada en `07-experiment-log.md` | T0.2 | P0 | submission aceptada y puntuada |
| **T3.3** | Diego + Héctor | T3.1 | Contrato API con el front (06 §1; sin `sector`) | `GET /api/companies`, `GET /api/companies/{id}/score` | T3.1 | P0 | el front de la demo pinta datos reales |
| T3.4 | Diego | T3.1 | Calibrar umbral de `momentum` y regla de `persistence` | parámetros en 06 | T3.1 | P1 | % de falsos baches medido |
| **T4.1** | Yo | T1.2 | Proxies O1-O5, etiquetados como ESTIMATED | `data/features/outcomes.parquet` | T1.2 | P0 | sin proxies no hay validación interna |
| T4.2 | Yo | T4.1, T3.1 | Probar H1-H13 con el protocolo de 04 | resultados en 07 | T4.1 | P1 | cada hipótesis con decisión |
| T4.3 | Yo | T2.1, T4.1 | Motor de analogías: k vecinos por vector de trayectoria y desenlace de los análogos | endpoint + frase | T4.1 | P1 | top-5 análogos por empresa con su desenlace |
| T4.4 | Yo | T4.1 | Orden de prelación (H6): qué pago se retrasa primero y con cuántos meses de adelanto | figura + frase de pitch | T4.1 | P1 | medido en meses |
| T5.1 | Diego | T4.1 | V1 con pesos aprendidos (coeficientes ≥ 0) | V1 + comparación con V0 | T4.1 | P1 | adoptado solo si gana (06 §5) |
| T5.2 | Diego | T5.1 | Ablación por pilar | tabla en 07 | T5.1 | P1 | hecha |
| T5.3 | Diego | T3.2 | Ajustar α (nivel vs trayectoria) con pocas submissions | α final | T3.2 | P1 | el mismo α gana también en CV por grupo |
| T5.4 | Diego | T5.1 | Contraste LightGBM monótono + SHAP | resultados en 07 | T5.1 | P2 | — |
| **T6.1** | Diego | T3.1 (o T5.1) | Informe con las métricas de 06 §6: generalización, AUC mejora y deterioro, estabilidad, **meses de anticipación** | `09-model-validation-report.md` | T4.1 | P0 | los tres bloques del reto tienen número |
| T6.2 | Diego | T6.1 | Limitaciones (proxies, datos sintéticos, fotos, historia corta) | sección en 09 | T6.1 | P1 | escrita |
| T7.1 | Felipe | T1-T3 | Un comando que rehace todo desde `data/raw` | `python -m pipeline` (o `make all`) | T3.1 | P1 | corre de cero en una máquina limpia |
| T7.2 | Diego | T3.4 | Monitor: alertas en las dos direcciones (`caída estructural`, `mejora sostenida`) | lista de alertas + endpoint | T3.4 | P1 | bonus "monitor que avisa" demostrable |
| T7.3 | Felipe | 05 | Ingesta de fuentes nuevas del source map | — | T7.1 | P2 | — |

## Cadena crítica

```
T0.1 ─► T1.1 ─► T1.2 ─► T2.1 ─► T2.4 ─► T3.1 ─► T3.3 ─► demo
                  │               ▲        └──► T3.2 (leaderboard) ◄── T0.2
                  └──► T4.1 ──────┴──► T6.1 (números del pitch)
T0.2 ─► T1.4 ─► T2.4
```

Felipe y Yo trabajamos en paralelo desde T1.2 (Felipe amplía el pipeline; yo features y proxies).
Diego arranca T3.1 en cuanto existan T2.1 y T2.4; mientras, cierra T0.4.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| **Producto y comprador no tienen responsable en este plan** y son un tercio de la nota | asignarlos hoy; el score solo no es la entrega |
| Formato del leaderboard desconocido | T0.2 es lo primero |
| Proxies de desenlace = asunción propia | declararlo en la demo; el leaderboard manda |
| Fuga por fotos a fecha de corte | reglas de 01 + test T2.3 + checklist de 06 §7 |
| Historia corta | `confidence` en la salida; `min_periods` |
| Sobreingeniería | V0 sin entrenamiento primero; V1 solo si gana |
