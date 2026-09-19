# Embat X-Ray — scoring de salud financiera de PYMEs sobre datos de tesorería

Implementación completa de la [arquitectura de referencia](../docs/arquitectura.pdf) (HackSpain — reto Embat):
un sistema de *machine learning* que estima la **probabilidad calibrada de deterioro financiero a 6 meses**
de una empresa a partir de su actividad de tesorería (cuentas, financiación, transacciones y facturas),
sin LLMs ni RAG en el camino crítico de la predicción.

> **Tesis que el sistema demuestra empíricamente**: el *scoring* crediticio clásico (balance, deuda, antigüedad)
> es tardío y de baja frecuencia; la tesorería diaria contiene señales de comportamiento que anticipan el deterioro
> meses antes. Entrenamos dos modelos sobre la misma etiqueta y el mismo *split* temporal —
> **Modelo A** ("proxy FICO", solo variables tipo balance) y **Modelo B** (A + comportamiento) — y medimos el *lift*.

## Resultado en una línea

| | AUC‑PR (holdout) | AUC‑ROC | precision@50 | Brier |
|---|---|---|---|---|
| Regresión logística — A | 0,345 | 0,721 | 0,47 | 0,274 |
| Regresión logística — B | 0,410 | 0,763 | 0,53 | 0,260 |
| LightGBM — **A** (proxy FICO, 30 variables) | 0,386 | 0,760 | 0,53 | 0,137 |
| LightGBM — **B** (A + comportamiento, 154 variables) | **0,445** | **0,824** | **0,56** | 0,123 |
| CatBoost — B | 0,466 | 0,838 | 0,54 | 0,118 |
| **Principal servido**: ensemble LightGBM+CatBoost B, calibrado | 0,464 | 0,837 | 0,59 | **0,099** |

**Lift de B sobre A (LightGBM): +0,060 AUC‑PR, IC 95 % bootstrap [+0,030; +0,094], P(lift ≤ 0) < 0,1 %.**
Base rate del holdout: 14,0 % (AUC‑PR de 0,46 ≈ 3,3× el azar). Frente al *baseline* LR‑A, el modelo principal gana +0,116 AUC‑PR [+0,07; +0,16].
El 82 % de la importancia SHAP del modelo B proviene de los bloques de comportamiento (B–F). Las 82 empresas del test simulado
quedan fuera de todo esto (ver tabla siguiente): en ellas el lift es +0,16.

El lift es robusto al diseño del *target* (§ Sensibilidad): positivo en las cuatro combinaciones ventana × umbral.

## Qué pide el reto X-Ray y dónde está cada cosa

| Requisito del reto | Dónde | Resultado |
|---|---|---|
| **Test (no hay test oficial → test simulado)** | `split_test.py` reserva **82 empresas de 23 grupos enteros** (`data/test_companies/`, mismo formato CSV) que **no entran en la etiqueta, el entrenamiento ni la calibración**; `evaluate_test.py` las puntúa con `predict.py` como si fueran el test oculto y compara con lo que les pasó | Modelo B: **AUC‑ROC 0,823 / AUC‑PR 0,448** (base 11 %) vs. Modelo A 0,790 / 0,281 → lift **+0,16 [+0,07; +0,25]**. Se deteriora el 53 % de las "riesgo", 25 % de "vigilar", 5 % de "sana", 3 % de "sólida"; 28 % de las "deteriorándose" vs. 9 % de las "estable" (`reports/test_companies_eval.json`) |
| **Predicción sobre empresas nuevas** | `python -m src.predict --raw <csv> --out <salida>` → `predictions_latest.csv` (una fila por empresa: salud, banda, trayectoria, señal, razones) + `predictions.csv` (todos los meses) + `changes.csv` | 82 empresas en ~25 s; mismo código de features que en entrenamiento, sin reentrenar |
| **Generaliza a empresas no vistas** (segunda comprobación, dentro del entrenamiento) | `src/train.py` aparta además el 25 % de los grupos restantes y evalúa en los meses de holdout | Modelo B: AUC‑ROC **0,813** / AUC‑PR 0,496 en empresas apartadas; el Modelo A cae a 0,612: **el balance memoriza empresas; el comportamiento generaliza** |
| **Señalización bidireccional**: sólidas / mejorando / deteriorándose | `src/health.py`: salud = 100·(1−p), suavizada (EMA); trayectoria por Δ 3 m con consistencia; bandas sólida ≥ 90 · sana ≥ 75 · vigilar ≥ 50 · riesgo | Último mes: cientos de sólidas, decenas en mejora progresiva, deterioros incipientes y caídas estructurales (tabla `alerts`, vista Alertas) |
| **Bache puntual vs. caída estructural** | `is_blip` (caída de un mes recuperada al siguiente) vs. `is_structural` (deteriorándose 3 meses seguidos); el suavizado evita que un mes malo cambie la lectura | 16 % de los cambios de banda se revierten al mes siguiente (estabilidad, fuera de muestra) |
| **Cuántos meses antes anticipa** | `evaluate.anticipation_analysis`: eventos reales de deterioro (caja < 0, ≥ 50 % de facturas a pagar con > 30 d, o cese de actividad, ≥ 2 meses seguidos tras ≥ 3 buenos) vs. primera alerta de un modelo congelado en 2025‑05 (scores fuera de muestra) | **243 eventos, 80 % anticipados, adelanto mediano 4 meses**, 28 % de falsas alertas (`reports/anticipation.json`). En las 82 empresas de test: 21 eventos, 83 % anticipados, mediana 2,5 meses, 14 % de falsas alertas |
| **Explicar qué señales causaron el cambio** | `score_change_explanation` (Δ SHAP entre T−1 y T, señales propias de la empresa) → `GET /companies/{id}/changes` y "Qué ha cambiado este mes" en la ficha | "Meses en descubierto (3 m): 3 meses (antes: 0)" |
| **Explicación por empresa** | TreeSHAP top‑8 en lenguaje natural, precalculado → `GET /companies/{id}/score` | — |
| **Trayectoria documentada** | serie mensual de salud (cruda y suavizada) por empresa en la ficha y en `risk_score` | — |
| **Bonus: monitor proactivo** | tabla `alerts` → `GET /alerts` y vista **Alertas** del dashboard | 5 tipos de señal, con el "por qué" |
| Producto y comprador | **Radar de salud financiera para el tesorero/CFO** (Cartera · Alertas · Ficha · Benchmarks · Simulador), vendible por Embat como módulo de su plataforma de tesorería | responde "¿de qué me preocupo hoy?" en < 10 s; demo navegable en Streamlit (y frontend React del equipo en `../frontend`) |

## Cómo reproducirlo (un comando)

```bash
cd pipeline
pip install -r requirements.txt
python -m src.pipeline all        # ≈ 8 min: CSV → Parquet → panel → split test → etiqueta → features → modelos → SHAP → BD → test
python -m uvicorn src.api.main:app --port 8000            # API (capas 9-10)      → http://localhost:8000/docs
python -m streamlit run src/frontend/app.py               # dashboard (capa 11)   → http://localhost:8501
python -m src.evaluate_test                                # test simulado: puntúa las 82 empresas reservadas y las evalúa
python -m src.predict --raw <carpeta_csv> --out <salida>   # cualquier conjunto de empresas nuevas → predicciones
```

Con `make` (`make all`, `make api`, `make frontend`, `make test`, `make sensitivity`) o con Docker
(`docker compose up --build` → postgres + api + frontend; el pipeline offline se ejecuta antes en el host o con
`docker compose run --rm api python -m src.pipeline all`). Los CSV originales se leen de `../output/` (la carpeta de datos
del repo; `invoices.csv` y `transactions.csv` se obtienen del zip del reto), o de `data/raw/`, o de donde apunte `RAW_DIR`. Semilla fija (`SEED=42`) en todas partes, DuckDB en un hilo (también en la ingestión: la lectura
paralela cambia el orden de las filas y con él el último bit de las sumas) y LightGBM `deterministic`: dos ejecuciones completas
desde los CSV producen **exactamente** las mismas etiquetas, features y métricas (verificado por hash). Variables de
entorno en `.env` (ver `.env.example`).

Tests: `python -m pytest -q tests` — unitarios (ventanas, tendencias, embargo temporal, codificación, calibración) +
**smoke test end-to-end** sobre un dataset sintético generado en el momento (`tests/make_sample_data.py`), que es el que
ejecuta la CI de GitHub Actions (`../.github/workflows/ci.yml`: lint + tests + smoke).

## Estructura (una carpeta/módulo por capa del documento)

```
src/config.py         decisiones: ventanas, umbrales, pesos del target, semilla, bandas, rutas
src/ingest.py         Capa 1  — CSV → Parquet zstd (DuckDB streaming, tipado explícito, particionado por mes) + informe de calidad
src/schema.py         Capa 2  — esquema estrella (vistas DuckDB) y tablas empresa × mes (cm_tx, cm_cash, cm_invoice_lag, …)
src/labels.py         Capa 3  — target: índice compuesto de deterioro D sobre la ventana de resultado
src/features.py       Capa 4  — panel empresa × mes, 154 features en 6 bloques (nivel + tendencia, ventanas 1/3/6/12)
src/models.py         pipelines sklearn (preproceso + modelo) que se serializan enteros; calibrador Platt
src/train.py          Capa 5  — validación temporal expansiva con embargo, A vs B, ablación, bootstrap, calibración
                      Capa 7  — registro: models/registry/<versión>/{pipeline.joblib, lgbm_B.txt, metadata.json}
src/evaluate.py       Capa 6  — TreeSHAP global/local, explicación de cambios, anticipación, figuras, errores → reports/
src/health.py         salud bidireccional (0–100), suavizado, trayectoria, bache vs. estructural, sólidas, alertas
src/split_test.py     reserva ~80 empresas (grupos enteros) como test simulado → data/test_companies/
src/predict.py        empresas nuevas: CSVs → predicciones + explicaciones, sin reentrenar
src/evaluate_test.py  puntúa las empresas reservadas con predict.py y las compara con lo que les pasó
src/sensitivity.py    § 16   — 3 vs 6 meses × p85 vs p90
src/serve_db.py       Capa 8  — BD servida (SQLite / PostgreSQL): company, company_month_kpi, risk_score (+ salud/trayectoria),
                                score_explanation, score_change_explanation, alerts, benchmark, model_info
src/providers.py      proveedores financieros: bancos y conectores de cada empresa, agregados con su salud (pestaña Proveedores)
src/api/              Capas 9-10 — FastAPI: inference.py (modelo cargado una vez, SHAP, escenarios), db.py, main.py (endpoints, auth, rate limit, log)
src/frontend/app.py   Capa 11 — dashboard Streamlit (6 vistas: Cartera · Alertas · Ficha · Benchmarks · Simulador · Rendimiento) que consume la API; el frontend React del equipo vive en ../frontend
src/pipeline.py       orquestador (= make all)
tests/                unitarios + smoke end-to-end con datos sintéticos
Dockerfile, docker-compose.yml, Makefile, ../.github/workflows/ci.yml, .env.example  Capa 12
```

Artefactos generados: `data/parquet/` (almacén columnar, 136 MB desde 617 MB de CSV), `data/quality/quality_report_*.json`,
`reports/` (métricas, figuras PNG, explicaciones), `models/registry/`, `data/serve.db`. En el repo solo van los ligeros
(métricas JSON, figuras, `metadata.json` del modelo servido); el resto se regenera con `python -m src.pipeline all`.

## Lo que dicen los datos (y cómo condicionó el diseño)

* **No hay variable objetivo** → se construye (Capa 3). Es la decisión con más impacto y está documentada abajo.
* **No hay grafo entre empresas** (contrapartidas disjuntas) → nada de GNN; la estructura explotable es grupo→empresa,
  empresa→banco y la concentración intra‑empresa (bloques D y E).
* **`balances.csv` es una foto a 2026‑09‑01**, no una serie. Reconstruimos el saldo a fin de cada mes hacia atrás:
  `saldo_T = saldo_foto − Σ movimientos posteriores a T` (por producto). Validado: la mediana de caja reconstruida es estable
  (~85–100 k€) y un 5–8 % de empresas activas está en negativo en cada mes. Lo mismo para las líneas de crédito → **utilización
  reconstruida en el tiempo** (estrés de deuda).
* **El estado `overdue` de las facturas es también una foto**: en las vencidas, `payment_date == due_date` es un *placeholder*.
  Reconstruimos el estado de cada factura *tal como se veía en T* (pagada / abierta, DPD a fecha T), lo que evita la fuga de
  etiqueta más obvia del dataset.
* **Los datos "sucios" son señal**: proporción de movimientos sin contrapartida, sin estado contable, descartados; meses sin
  sincronización del ERP; país no informado. Entran como features (bloque F), no se imputan.
* **Volumen**: 2,5 M transacciones + 0,9 M facturas se agregan en SQL (DuckDB) hasta tablas empresa × mes; pandas solo toca
  ~30 k filas. Ingestión completa en < 1 min; pipeline completo ≈ 7 min.
* **Informe de calidad**: 0 fallos de parseo; 552 `due_date` y 472 `payment_date` fuera de [2023, 2028] (se registran y se
  excluyen); 1 314 transacciones con `product_id` huérfano; 501 empresas sin facturas (39 %), 0 sin transacciones.

## Capa 3 — definición del target (decisión explícita)

Marco temporal (Figura 3 del documento): **ventana de observación** de hasta 12 meses hasta T (features) · **gap** de 1 mes ·
**ventana de resultado** de 6 meses (T+2 … T+7). Nada calculado después de T entra como feature.

Índice compuesto de deterioro sobre la ventana de resultado:

$$D_i = \sum_k w_k\, z_{ik}, \qquad y_i = \mathbb{1}[\,D_i > Q_{0.85}(D)\,]$$

| componente | peso | cálculo en la ventana de resultado |
|---|---|---|
| Morosidad emergente `late_pay_rate` | 0,30 | % facturas **a pagar** vencidas en la ventana pagadas con DPD > 30 o impagadas > 30 días (a fecha de la foto). Las vencidas hace < 30 días no son clasificables y se excluyen (censura). Requiere ≥ 3 facturas. |
| Iliquidez sostenida `neg_cash_share` | 0,25 | % meses con caja reconstruida (cuentas corrientes/ahorro) < 0 |
| Colapso de cobros `collection_drop` | 0,20 | 1 − cobros operativos medios en la ventana / cobros medios de los 6 meses previos a T (recortado a [−1, 1]) |
| Estrés de deuda `credit_util` | 0,10 | utilización media de líneas de crédito (dispuesto reconstruido / concedido) |
| Cese de actividad `inactivity` | 0,15 | % meses de la ventana sin ninguna transacción |

Cada componente se *winsoriza* (1–99 %) y se estandariza (z‑score) **dentro de su cohorte de tamaño** (cuartil de pagos
operativos) para que el tamaño no domine. Cortes de cohorte, medias, desviaciones y umbral se **ajustan solo con las
empresas de entrenamiento** y se aplican a las 82 reservadas para test. Los pesos se renormalizan sobre los componentes disponibles (una empresa sin ERP no
tiene `late_pay_rate`); se exige ≥ 2 componentes. Filas elegibles: empresa activa en los 3 meses hasta T.
Resultado: **13 143 filas empresa‑mes, 1 197 empresas (72 de ellas de test), 15 % positivos**, tasa estable por mes (12–18 %), y los cinco
componentes correlacionan con D (0,25–0,70), es decir, ninguno lo monopoliza.

**Disciplina anti‑fuga (regla dura)**: todo lo usado en D está prohibido como feature *en la ventana de resultado*; las mismas
magnitudes medidas *hasta T* sí son features (el DPD de hoy predice el impago de dentro de seis meses; el DPD de dentro de seis
meses *es* el impago). No se usa el `outstanding` de la foto como feature (sería información futura); sí las magnitudes
reconstruidas a T.

## Capa 4 — bloques de features (154 variables, nivel + tendencia)

| bloque | n | contenido | rol |
|---|---|---|---|
| **A** Estructural ("lo que ve un banco") | 30 | nº cuentas/bancos/productos de deuda, financiación concedida, tipo medio, plazo, antigüedad, país, divisa, ERP, tamaño de grupo, saldo de caja a T, utilización de líneas a T, servicio de la deuda, facturación anual | **Modelo A** |
| **B** Comportamiento de pago | 37 | DPD medio/p90 a proveedores en 3/6/12 m *observado en T*, % vencidas abiertas, importe vencido, **tendencia** del DPD y del % vencido, prelación (regularidad y día de pago de nóminas, Seg. Social, impuestos; impuestos 3 m vs 12 m), estacionalidad; lo simétrico para cobros de clientes | B |
| **C** Dinámica de liquidez | 42 | cobros/pagos en 1/3/6/12 m y ratio, tendencias, volatilidad, caja reconstruida (tendencia, volatilidad, mínimo, meses en negativo, días de caja), liquidaciones de intereses (nivel + tendencia), comisiones, utilización de crédito (máximo, tendencia), actividad, ciclo de cobro | B |
| **D** Concentración | 12 | HHI de cobros y pagos por contrapartida (6 m), peso del mayor cliente, nº efectivo de clientes, rotación de clientes, cambio del HHI | B |
| **E** Red / grupo / banco | 10 | media de estrés de las empresas hermanas del grupo **excluyendo la propia** (vencidas, caja negativa, ratio, intereses), nº hermanas activas, banco principal, estrés medio de las empresas del mismo banco | B |
| **F** Texto y calidad del dato | 23 | tasa de términos de estrés en descripciones (`devol|impag|embarg|reclam|…`) y su tendencia, % sin contrapartida / sin estado contable / descartados y sus deltas 3 m vs 12 m, actividad del ERP (facturas emitidas 3 m vs 12 m, meses desde la última), país/ERP no informados | B |

Todas se calculan sobre matrices empresa × mes (vectorizado); las agregaciones de eventos se hacen en DuckDB.

## Capa 5 — validación estrictamente temporal

Un `train_test_split` aleatorio mezclaría futuro y pasado. Además, con ventanas de resultado de 6 meses, dos filas de la misma
empresa separadas menos de 7 meses **comparten resultado**: entrenar con una y validar con la otra infla las métricas aunque el
split sea "temporal". Por eso el diseño es *rolling origin* con **embargo = gap + ventana = 7 meses**: para evaluar el mes T
solo se entrena con filas cuyo T ≤ T − 7, exactamente las etiquetas que ya se conocerían en T en producción.

* CV expansiva: fold1 evalúa 2025‑08/09 (train ≤ 2025‑01), fold2 evalúa 2025‑10/11 (train ≤ 2025‑03).
* **Holdout**: 2025‑12 y 2026‑01 (2 093 filas, 293 positivos, sin las empresas de test), train ≤ 2025‑05 (5 282 filas). Se toca una vez, al final.
* Modelos: regresión logística (baseline obligatorio), LightGBM (principal), CatBoost (contraste). Desbalanceo con
  `class_weight`/`auto_class_weights` (sin SMOTE). Ensemble por promedio **solo si mejora en CV** (lo hizo: 0,524 vs 0,515).
* Métricas: AUC‑PR principal, AUC‑ROC, precision@50 y recall@top‑10 % por mes, Brier + curva de calibración, métrica por fold.
* Calibración Platt ajustada sobre predicciones *out‑of‑fold*; Brier en holdout 0,118 → 0,099.
* Estabilidad por fold (AUC‑PR): LightGBM‑B 0,501 / 0,529 (σ 0,014) frente a LightGBM‑A 0,473 / 0,517 (σ 0,022).

## Capa 6 — de dónde viene el lift (ablación y SHAP)

Ablación con LightGBM en holdout (Δ AUC‑PR):

| añadir un bloque al baseline A | Δ vs A | | quitar un bloque al modelo B | Δ vs B |
|---|---|---|---|---|
| A + **C** liquidez | **+0,056** | | B − C | **−0,038** |
| A + F texto/calidad | +0,044 | | B − F | −0,015 |
| A + D concentración | +0,028 | | B − D | −0,004 |
| A + B pago de facturas | +0,014 | | B − B | +0,011 |
| A + E grupo/banco | −0,012 | | B − E | +0,026 |

Lectura honesta:

* **La dinámica de liquidez (C) —tendencia y volatilidad de la caja, meses en descubierto, liquidaciones de intereses, caída de
  la ratio cobros/pagos— es la que aporta el lift**, y está disponible para el 99 % de las empresas.
* El bloque B (timing de pago de facturas) **aporta donde existe** (empresas con ERP conectado, ~60 % del holdout) y es ruido en
  las demás. Los bloques son parcialmente redundantes entre sí (una empresa que deja de pagar facturas suele tener la caja en
  negativo), por eso quitar uno solo penaliza poco y quitarlos todos (= Modelo A) penaliza −0,060.
* SHAP global (TreeSHAP exacto): cuota de |SHAP| por bloque A 18 % · B 21 % · **C 30 %** · D 4 % · E 15 % · F 12 % → **82 % del
  score viene de comportamiento**. Variables top: saldo mínimo de caja sobre gasto (6 m), banco principal, ERP, contrapartidas
  distintas en facturas (3 m), antigüedad, % facturas a pagar con >30 días (12 m), transacciones del último mes, días de caja…
* **Análisis de errores** (holdout, top‑15 % marcado): 152 TP / 141 FN / 161 FP. El 46 % de los falsos negativos son deterioros
  cuyo componente dominante es el **cese súbito de actividad** y el 14 % el colapso de cobros — los menos anticipables desde
  la ventana de observación; los que vienen de morosidad e iliquidez se capturan mejor. Es el argumento para el simulador y para
  revisar la ponderación de `inactivity` en una v2.

Figuras en `reports/figures/`: `pr_curves_holdout.png`, `calibration_holdout.png`, `shap_global_top20.png`, `shap_by_block.png`,
`shap_beeswarm.png`, `ablation.png`.

## Sensibilidad del target (decisiones abiertas del § 16)

`python -m src.sensitivity` reentrena A vs B para cada variante (mismo diseño temporal, embargo = gap + ventana; cifras de la
versión anterior al split de test, con todas las empresas):

| variante | filas | AUC‑PR A (LGBM) | AUC‑PR B (LGBM) | B (CatBoost) | lift LGBM [IC 95 %] |
|---|---|---|---|---|---|
| **6 meses · p85 (por defecto)** | 13 143 | 0,386 | 0,466 | 0,490 | **+0,081 [+0,049; +0,112]** |
| 3 meses · p85 | 16 888 | 0,406 | 0,455 | 0,485 | +0,048 [+0,022; +0,075] |
| 6 meses · p90 | 13 143 | 0,296 | 0,354 | 0,311 | +0,058 [+0,027; +0,089] |
| 3 meses · p90 | 16 888 | 0,342 | 0,394 | 0,420 | +0,054 [+0,023; +0,086] |

El lift es significativo (IC 95 % excluye el 0) en las cuatro variantes. Decisiones cerradas: **ventana de 6 meses y percentil
85** (fiel a la figura del documento, mejores métricas absolutas y mayor lift); la ventana de 3 meses da 3 folds de CV y el
doble de filas de entrenamiento y queda como alternativa configurable (`OUTCOME_MONTHS=3`). **Streamlit** como frontend (equipo ML; el tiempo ahorrado fue a las capas 3 y 4).
**Simulador dentro del alcance** (5 escenarios + ajustes manuales). **Sin cloud**: todo local con Docker.

## Capas 8–11 — servicio y producto

* **BD servida** (`src/serve_db.py`): SQLite por defecto, PostgreSQL vía `DATABASE_URL` (docker‑compose). Tablas `company`,
  `company_month_kpi`, `company_features`, `risk_score` (score calibrado, percentil global y por cohorte, banda, Δ mensual,
  versión, marca in/out‑of‑sample, etiqueta realizada cuando existe), `score_explanation` (top‑8 SHAP por empresa y mes,
  precalculado — no se calcula SHAP en la petición), `benchmark` (p25/p50/p75 por cohorte tamaño × país × tamaño de grupo,
  **solo con ≥ 10 empresas**, con respaldo por tamaño), `model_info`.
* **API** (`src/api/`): `GET /health` (versión de modelo cargada), `GET /model/info`, `GET /companies` (paginado, filtros por
  banda de salud / trayectoria / cohorte, orden por caída o mejora en 3 m), `GET /companies/{id}`, `GET /companies/{id}/score`,
  `GET /companies/{id}/changes` (qué cambió este mes), `GET /companies/{id}/features`, `GET /alerts` (monitor proactivo),
  `GET /benchmarks`, `GET /portfolio/summary`, `POST /score` (payload de features → score + banda + SHAP), `POST /simulate`
  (escenario y/o *overrides* → antes/después), `GET /scenarios`. Pipeline cargado una vez al arrancar; validación Pydantic; API key opcional
  (`API_KEY`), *rate limit* por IP, log de accesos y tabla `inference_log`. OpenAPI en `/docs`.
* **Dashboard** (`src/frontend/app.py`): **Cartera** (tabla ordenada por Δ vs mes anterior — el delta importa más que el
  nivel — con bandas, filtros y evolución de la cartera), **Ficha de empresa** (score B vs A en el tiempo con el deterioro
  observado, explicación SHAP en lenguaje natural, series de caja/flujos, DPD y morosidad), **Benchmarks** (posición frente a
  la cohorte con su tamaño visible), **Simulador** ("el cliente principal paga 30 días más tarde", "dos meses en
  descubierto", "nueva línea de crédito"… + sliders), **Rendimiento del modelo** (A vs B con IC, estabilidad por fold,
  ablación, SHAP por bloque, análisis de errores).

El score histórico de los meses con etiqueta conocida (≤ 2026‑01) es *in‑sample* (el modelo final se entrena con todas las
filas etiquetadas); los meses 2026‑02 … 2026‑08 son *out‑of‑sample*. Las métricas del dashboard son siempre las del holdout.

## Salud bidireccional y trayectoria (reto X-Ray)

El modelo devuelve una probabilidad de deterioro a 6 meses; el producto la traduce a **salud = 100 · (1 − p)** y añade
lo que un score de un solo mes no da:

* **Suavizado** (EMA, α = 0,5): un mes malo no cambia la lectura; dos seguidos sí. Es lo que separa un bache de una caída.
* **Trayectoria**: mejorando / estable / deteriorándose si la salud suavizada cambia ≥ 8 puntos en 3 meses y al menos 2 de los
  3 deltas mensuales van en la misma dirección.
* **Bache puntual** (`is_blip`): caída ≥ 8 puntos en un mes recuperada (≥ 60 %) al siguiente. **Caída estructural**
  (`is_structural`): "deteriorándose" 3 meses seguidos. **Excepcionalmente sólida** (`is_exceptional`): salud ≥ 90 durante
  ≥ 6 meses seguidos.
* **Alertas**: caída estructural · caída brusca este mes (≥ 10 puntos) · deterioro incipiente · mejora progresiva ·
  excepcionalmente sólida.

Todos los umbrales están en `config.py` (`HEALTH_*`, `TRAJ_*`, `BLIP_DROP`, `EXCEPTIONAL_*`, `ALERT_*`) y los aplica el mismo
código (`src/health.py`) en el dashboard y en el test oculto.

**Anticipación** (`reports/anticipation.json`): se definen eventos reales de deterioro en los datos —independientes del
modelo— y se mide cuántos meses antes la salud (de un modelo congelado en 2025‑05, es decir, fuera de muestra) cayó por
debajo de 75 o la trayectoria pasó a "deteriorándose": 243 eventos, 80 % anticipados con adelanto mediano de 4 meses;
28 % de las alertas no van seguidas de evento en 9 meses; 16 % de los cambios de banda se revierten al mes siguiente.

## Capa 7 — registro de modelos

`models/registry/<versión>/`: `pipeline.joblib` (pipelines A y B **completos**: codificación + modelo, y calibrador),
`lgbm_B.txt` (booster nativo), `metadata.json` (commit, hash del dataset, semilla, hiperparámetros, esquema de entrada,
métricas por fold/holdout, lift con IC, ablación, calibración, configuración del target). `latest.txt` apunta a la versión servida.

## Riesgos y limitaciones (declarados)

* **Datos sintéticos**: las correlaciones pueden ser artefactos del generador. Validamos que las relaciones tienen sentido
  económico (caja negativa, intereses de descubierto, impago de proveedores, caída de cobros → deterioro) y que el lift es
  estable a la definición del target.
* **Target construido**: D es una decisión, no una verdad. Está documentada, ponderada y sometida a sensibilidad.
* **Reconstrucción desde la foto**: saldos y estados de factura reconstruidos hacia atrás; 123 cuentas con movimientos no tienen
  foto y quedan fuera de la caja reconstruida.
* **Muestra pequeña** (1 286 empresas; trainings de 2,6–5,6 k filas por el embargo): intervalos por bootstrap, sin presumir de
  decimales. Antes de fijar DuckDB a un hilo, diferencias de último bit en las agregaciones movían el lift entre +0,05 y +0,08:
  la dispersión real está dentro del IC.
* **Categóricas de alta cardinalidad** (`main_bank`, `erp_any`) pesan en SHAP: regularizadas (`min_data_per_group`, `cat_smooth`)
  y evaluadas fuera de tiempo, pero conviene vigilar que no actúen como identificador de empresa en producción.
* Sin despliegue en cloud: local + Docker, como recomienda el documento cuando el reto no lo puntúa.

## Orden en que se construyó (§ 17)

1. Ingestión a Parquet + informe de calidad → 2. panel empresa‑mes → 3. etiqueta v1 + regresión logística (primer número) →
4. bloques B–F + LightGBM/CatBoost (aparece el lift) → 5. SHAP + ablación (aparece la narrativa) → 6. API y persistencia →
7. frontend → 8. benchmarks, simulador, Docker/CI.
