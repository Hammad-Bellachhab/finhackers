# finhackers — reto X-Ray (HackSpain 2026, Embat)

Contexto para cualquier sesión de Claude Code en este repo. Última actualización: 2026-09-19.

## Qué es el proyecto

Sistema de **scoring de salud financiera de pymes** a partir de 24 meses de tesorería (movimientos bancarios,
facturas, financiación, saldos) y, encima, un **producto con comprador identificado**. El brief oficial está en
`docs/reto-embat.md` (si una decisión no encaja con lo de ahí, gana el brief). Criterios de evaluación con el mismo
peso: acierto (generalización a empresas no vistas, trayectoria, dos direcciones), anticipación (meses de adelanto,
estabilidad) y viabilidad (producto, comprador, explicación, demo).

**No hay test oculto oficial**: reservamos 82 empresas del propio dataset como test simulado (`pipeline/data/test_companies/`).

## Estructura del repo (rama `main`, todos hacen `git pull` de `main`)

```
data/raw/        los 8 CSV del reto, en git (invoices.csv y transactions.csv por Git LFS: `git lfs pull`)
pipeline/        MOTOR DE SCORING (Python) — ver pipeline/README.md, es la documentación completa con cifras
frontend/        SPA React + Vite (producto "Pulso"): se sirve estática en Cloudflare con las respuestas del motor
                 precalculadas en frontend/public/data/ por `python -m src.pulso` (contrato en frontend/src/api/types.ts)
docs/            brief, diccionario de datos, paleta, docs/superpowers/specs/2026-09-19-pulso-design.md
wrangler.jsonc   despliegue en Cloudflare (se publica solo en cada push a main); tasks/todo.md: lista del equipo
.github/workflows/ci.yml   lint + tests + smoke test del pipeline
```

Despliegue: tras cambiar datos o modelo, `python -m src.pipeline all` y luego `python -m src.pulso` (≈ 4 min, regenera
`frontend/public/data/`), commit + push y Cloudflare publica. La rama `clean-start` fue un reinicio del compañero, ya
fusionada en `main`; no usarla.

## El motor (`pipeline/`) en una pasada

Cadena `python -m src.pipeline all` (≈ 8 min, reproducible bit a bit: DuckDB en un hilo, LightGBM determinista, SEED=42):

| paso | fichero | qué hace |
|---|---|---|
| ingest | `src/ingest.py` | CSV → Parquet tipado + informe de calidad (`data/quality/`) |
| schema | `src/schema.py` | SQL DuckDB: tablas empresa × mes (`cm_*`); reconstruye saldos hacia atrás y el estado de cada factura "tal como se veía en T" |
| split | `src/split_test.py` | reserva ~80 empresas (grupos enteros) como test simulado |
| labels | `src/labels.py` | target: índice D de 5 síntomas en los 6 meses siguientes (gap 1), z-score por cohorte de tamaño, 15 % peor = 1; ajustado solo con empresas de entrenamiento |
| features | `src/features.py` | 154 features en bloques A–F, ventanas 1/3/6/12 + tendencias, solo datos ≤ T |
| train | `src/train.py` | LR + LightGBM + CatBoost, Modelo A (solo bloque A) vs B (todo), validación temporal con **embargo = gap + ventana (7 m)**, bootstrap, ablación, empresas no vistas, calibración Platt, registro en `models/registry/` |
| evaluate | `src/evaluate.py` | TreeSHAP (global, local, cambio mes a mes), anticipación fuera de muestra, figuras, errores |
| db | `src/serve_db.py` | SQLite `data/serve.db` (Postgres vía DATABASE_URL): risk_score con salud/trayectoria, alerts, explicaciones, benchmarks |
| test | `src/evaluate_test.py` | `predict.py` sobre las 82 empresas reservadas + comparación con lo que les pasó |

Otros: `src/providers.py` (bancos y conectores agregados con la salud de sus empresas → pestaña Proveedores),
`src/health.py` (probabilidad → salud 0–100, suavizado EMA, trayectoria, bache vs. estructural, sólidas, alertas;
umbrales en `config.py`), `src/predict.py` (CSV de empresas nuevas → predicciones, sin reentrenar), `src/api/`
(FastAPI puerto 8000: /companies, /companies/{id}/score, /changes, /alerts, /benchmarks, /simulate…),
`src/frontend/app.py` (dashboard Streamlit de referencia, 6 vistas), `src/sensitivity.py` (3/6 meses × p85/p90).

Comandos desde `pipeline/`:
```bash
pip install -r requirements.txt
python -m src.pipeline all
python -m uvicorn src.api.main:app --port 8000
python -m streamlit run src/frontend/app.py
python -m pytest -q tests          # 12 tests, ~3 min (incluye smoke end-to-end con datos sintéticos)
python -m src.predict --raw <carpeta_csv> --out <salida>
```
Sin `make` en Windows: usar `python -m src.pipeline <pasos>`. Python 3.14 en la máquina de Diego; CI en 3.12.

## Cifras vigentes (modelo v20260919_151311; fuente: pipeline/README.md y reports/)

- Holdout temporal (empresas de entrenamiento, meses futuros): LightGBM B AUC-ROC 0,824 / AUC-PR 0,445 vs A 0,760 / 0,386;
  lift +0,060 [+0,030; +0,094]. Principal servido: ensemble LightGBM+CatBoost calibrado (Brier 0,118 → 0,099).
- **Test simulado (82 empresas nunca vistas)**: B 0,820 / 0,445 vs A 0,790 / 0,281 → lift +0,16 [+0,07; +0,25].
  Se deteriora el 53 % de las "riesgo", 25 % "vigilar", 5 % "sana", 3 % "sólida"; 28 % de "deteriorándose" vs 9 % "estable".
- Anticipación (fuera de muestra): 243 eventos, 80 % anticipados, mediana 4 meses, 28 % falsas alertas, 16 % flips de banda.
- 82 % de la importancia SHAP en bloques de comportamiento; el bloque C (dinámica de liquidez) es el que más aporta.
- Límites declarados: dataset sintético; etiqueta construida (probada con 4 variantes); los ceses súbitos de actividad
  son los deterioros que peor se anticipan (46 % de los falsos negativos).

## Decisiones de producto

Concepto del compañero: **Pulso** (Pulso Empresa + Pulso Cartera; lo paga la pyme, lo cobra Embat como módulo).
Decisión del equipo (Diego, 2026-09-19): orientarlo a **"Pulso Crédito — la línea de crédito que respira"**: límite y
precio de la línea recalculados cada mes con salud + trayectoria; el prestamista paga el motor; la pyme comparte su
score (nunca movimientos) con consentimiento explícito, mínimo y revocable, a cambio de crédito más barato, más rápido
y con aviso previo al recorte; Embat es el canal (coste marginal cero). Narrativa: "de la foto al pulso, de castigar a
premiar, del corte de grifo al aviso, del banco que juzga a la empresa que se enseña". Ante jurado financiero,
"no existe hoy para una pyme y está medido" convence más que "revolucionario".

**Pendiente para la demo** (no construido): tabla de reglas salud/trayectoria → límite y precio; pantalla del
prestamista (cartera de líneas con alertas); pantalla de consentimiento de la pyme. El front de Pulso ya consume el
motor vía `src/pulso.py` (export estático); cualquier dato nuevo para el front se añade ahí y se regenera.

## Cómo trabajar en este repo

- **Antes de construir algo que no se haya pedido explícitamente, preguntar.** Diego no es experto en ML: explicar en
  lenguaje llano, con ejemplos, y una cosa cada vez.
- **Commit en `main` tras cada cambio** y decir si se ha hecho push. No subir binarios ni datos (ver `.gitignore`:
  Parquet, serve.db, joblib, CSV de test y `work/` quedan fuera; sí se suben `metadata.json`, informes y figuras).
- Tras cambiar el modelo o las reglas: `python -m src.pipeline train evaluate db test`, actualizar cifras del
  `pipeline/README.md`, `pytest`, y dejar solo la versión servida en `models/registry/` (borrar las antiguas).
- Puede haber **otra sesión de Claude** (la del front/Pulso) trabajando en el mismo repo: `git fetch` + `git pull --rebase`
  antes de commitear y nunca forzar pushes. Esa sesión también toca `pipeline/src` (p. ej. `pulso.py`, limpiezas).
- Datos: `config.py` busca los CSV en `../data/raw`, `../output`, `pipeline/data/raw` o `RAW_DIR`. La carpeta
  `output/` local es un duplicado antiguo, no está en git y se puede borrar.
