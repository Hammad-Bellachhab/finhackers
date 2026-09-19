# finhackers — reto X-Ray (HackSpain 2026, Embat)

Contexto para cualquier sesión de Claude Code en este repo. Última actualización: 2026-09-20 (madrugada).

## Qué es el proyecto

Sistema de **scoring de salud financiera de pymes** a partir de 24 meses de tesorería (movimientos bancarios,
facturas, financiación, saldos) y, encima, un **producto con comprador identificado**. El brief oficial está en
`docs/reto-embat.md` (si una decisión no encaja con lo de ahí, gana el brief). Criterios de evaluación con el mismo
peso: acierto (generalización a empresas no vistas, trayectoria, dos direcciones), anticipación (meses de adelanto,
estabilidad) y viabilidad (producto, comprador, explicación, demo). Lema del brief: un modelo sencillo con producto
claro vale más que uno sofisticado que se queda en el número.

**No hay test oculto oficial**: reservamos 82 empresas del propio dataset como test simulado (`pipeline/data/test_companies/`).
Si el día de la evaluación llegan CSV nuevos: `python -m src.predict --raw <csv> --out <salida>`.

## Equipo y forma de trabajar

- **Diego** (sesión del motor): scoring, producto y pitch. No es experto en ML: explicar en lenguaje llano, con
  ejemplos, una cosa cada vez. **Antes de construir algo que no se haya pedido explícitamente, preguntar.**
- **Compañero** (otra sesión de Claude/Cursor, mismo repo): front React "Pulso", despliegue en Cloudflare, TellMe,
  `pulso.py`, `projection.py`, `providers.py`, `tellme.py`, y limpiezas en `pipeline/src`. Lista viva en `tasks/todo.md`.
- Rama única **`main`**; todos hacen `git pull`. Antes de commitear: `git fetch` + `git pull --rebase origin main`.
  Nunca forzar pushes. **Commit tras cada cambio** y decir si se ha hecho push. La rama `clean-start` está fusionada; no usarla.
- No subir binarios ni datos generados (`.gitignore`: Parquet, `serve.db`, joblib, CSV del test simulado, `work/`,
  `.dev.vars`). Sí se suben `metadata.json`, informes JSON/CSV y figuras.
- **Codificación**: todo fichero de texto se lee/escribe con `encoding="utf-8"` explícito (en Windows el default es cp1252
  y rompía las tildes de los JSON en Linux/CI). Mantenerlo en código nuevo.
- Windows sin `make`: usar `python -m src.pipeline <pasos>`. Python 3.14 en la máquina de Diego; CI en 3.12.
- Diego prefiere **ver el producto desplegado, no en local**. Servidores locales solo si lo pide.
- Datos: `config.py` busca los CSV en `../data/raw`, `../output`, `pipeline/data/raw` o `RAW_DIR`. La carpeta
  `output/` local de Diego es un duplicado antiguo, fuera de git, borrable.

## Estructura del repo

```
data/raw/        los 8 CSV del reto, en git (invoices.csv y transactions.csv por Git LFS: `git lfs pull`)
pipeline/        MOTOR DE SCORING (Python) — pipeline/README.md es la documentación completa con cifras y decisiones
frontend/        SPA React + Vite + TS (producto "Pulso"): landing, cartera, empresa, proveedores, TellMe; datos
                 precalculados en frontend/public/data/ por `python -m src.pulso` (contrato: frontend/src/api/types.ts)
worker/index.js  Cloudflare Worker: sirve el front estático y `POST /api/ask` (chat TellMe → Gemini)
wrangler.jsonc   despliegue en Cloudflare (Worker `finhackers`; se publica solo en cada push a main)
docs/            brief, diccionario de datos, paleta, specs de Pulso (docs/superpowers/specs/*.md)
tasks/           todo.md (lista del equipo), progress-agente-ia.md, checklist-datos.md, lessons.md
.github/workflows/ci.yml   lint + tests + smoke test del pipeline (Linux, Python 3.12)
.claude/launch.json        previews locales: api (8000), dashboard Streamlit (8501), pulso (npm run dev, 5173)
```

**URL pública del front: no está apuntada en el repo.** Será `https://finhackers.<subdominio>.workers.dev` o un dominio
propio; la cuenta de Cloudflare es del compañero (en la máquina de Diego `wrangler` no está autenticado). Cuando se
sepa, apuntarla aquí y en el README.

Despliegue: tras cambiar datos o modelo → `python -m src.pipeline all` → `python -m src.pulso` (≈ 4 min, regenera
`frontend/public/data/`; ojo: hace `rmtree`, se lleva los `tellme.json`). Si solo cambia la proyección,
`python -m src.pulso forecast` reescribe únicamente los `forecast.json`. Commit + push y Cloudflare publica.

## El motor (`pipeline/`) en una pasada

`python -m src.pipeline all` (≈ 10 min, reproducible bit a bit: DuckDB en un hilo también en la ingestión, LightGBM
determinista, SEED=42; CatBoost varía en milésimas entre ordenadores):

| paso | fichero | qué hace |
|---|---|---|
| ingest | `src/ingest.py` | CSV → Parquet tipado + informe de calidad (`data/quality/`) |
| schema | `src/schema.py` | SQL DuckDB: tablas empresa × mes (`cm_*`); reconstruye saldos hacia atrás y el estado de cada factura "tal como se veía en T" |
| split | `src/split_test.py` | reserva ~80 empresas (grupos enteros, semilla fija) como test simulado |
| labels | `src/labels.py` | target: índice D de 5 síntomas en los 6 meses siguientes (gap 1), z-score por cohorte de tamaño, 15 % peor = 1; ajustado solo con empresas de entrenamiento |
| features | `src/features.py` | 154 features en bloques A–F, ventanas 1/3/6/12 + tendencias, solo datos ≤ T |
| train | `src/train.py` | LR + LightGBM + CatBoost; Modelo A (solo bloque A) vs B (todo); validación temporal con **embargo = gap + ventana (7 m)**; bootstrap; ablación; empresas no vistas; calibración Platt; registro en `models/registry/` |
| evaluate | `src/evaluate.py` | TreeSHAP (global, local, cambio mes a mes), anticipación fuera de muestra, figuras, análisis de errores |
| db | `src/serve_db.py` | SQLite `data/serve.db` (Postgres vía DATABASE_URL): risk_score con salud/trayectoria, alerts, explicaciones, benchmarks |
| test | `src/evaluate_test.py` | `predict.py` sobre las 82 empresas reservadas + comparación con lo que les pasó |
| projection | `src/projection.py` | proyección a 6 meses por montecarlo empírico (2.000 trayectorias de meses-empresa comparables), banda p10–p90, backtest en `reports/projection_backtest.json` |

Otros: `src/health.py` (probabilidad → salud 0–100, suavizado EMA, trayectoria mejorando/estable/deteriorándose,
bache vs. estructural, sólidas, alertas; umbrales en `config.py`), `src/predict.py` (CSV de empresas nuevas →
predicciones + explicaciones, sin reentrenar), `src/api/` (FastAPI 8000: /companies, /companies/{id}/score, /changes,
/alerts, /benchmarks, /simulate…), `src/pulso.py` (export estático para el front), `src/providers.py` (pestaña
Proveedores: bancos/conectores y la salud de sus empresas), `src/tellme.py` (análisis pregenerados para TellMe),
`src/frontend/app.py` (dashboard Streamlit de referencia; pendiente de migrar del todo al front y borrarlo),
`src/sensitivity.py` (3/6 meses × p85/p90), `src/metrics.py`.

Comandos desde `pipeline/`:
```bash
pip install -r requirements.txt
python -m src.pipeline all
python -m src.pulso                                # export para el front
python -m uvicorn src.api.main:app --port 8000     # API local (solo si se pide)
python -m streamlit run src/frontend/app.py        # dashboard local (solo si se pide)
python -m pytest -q tests                          # 12 tests, ~3 min (smoke end-to-end con datos sintéticos)
python -m src.predict --raw <carpeta_csv> --out <salida>
```
Tras cambiar modelo o reglas: `python -m src.pipeline train evaluate db test projection`, actualizar cifras de
`pipeline/README.md` y de este fichero, `pytest`, y dejar solo la versión servida en `models/registry/`.

## Cifras vigentes (modelo v20260919_192058; fuente: pipeline/README.md y pipeline/reports/)

- Holdout temporal (empresas de entrenamiento, meses futuros): LightGBM B AUC-ROC 0,824 / AUC-PR 0,445 vs A 0,760 / 0,386;
  lift +0,060 [+0,030; +0,094]. Servido: ensemble LightGBM+CatBoost calibrado (Brier 0,118 → 0,099).
- **Test simulado (82 empresas nunca vistas)**: B 0,823 / 0,448 vs A 0,790 / 0,281 → lift **+0,16 [+0,07; +0,25]**.
  Se deteriora el 53 % de las "riesgo", 25 % "vigilar", 5 % "sana", 3 % "sólida"; 28 % de "deteriorándose" vs 9 % "estable".
- Anticipación (fuera de muestra): 243 eventos reales, 80 % anticipados, mediana 4 meses, 28 % falsas alertas,
  16 % de cambios de banda revertidos al mes siguiente. En las 82 de test: 21 eventos, 83 % anticipados, 14 % falsas.
- Empresas apartadas dentro del entrenamiento: B 0,813 vs A 0,612 de AUC-ROC → el balance memoriza empresas, el
  comportamiento generaliza. 82 % de la importancia SHAP en bloques de comportamiento; el bloque C (dinámica de
  liquidez) es el que más aporta; el B (facturas) solo ayuda donde hay ERP conectado.
- Proyección montecarlo (82 de test): cobertura 80,9 %, MAE 4,91.
- Límites declarados: dataset sintético; etiqueta construida (probada con 4 variantes); los ceses súbitos de actividad
  son los deterioros que peor se anticipan (46 % de los falsos negativos); el accuracy (~85–87 %) engaña con 11–15 % de positivos.

## Producto y pitch

- Concepto base del compañero: **Pulso** (Pulso Empresa + Pulso Cartera + Proveedores + TellMe); lo paga la pyme, lo
  cobra Embat como módulo. Spec en `docs/superpowers/specs/2026-09-19-pulso-design.md`.
- Decisión de Diego (2026-09-19): orientar el pitch a **"Pulso Crédito — la línea de crédito que respira"**: límite y
  precio recalculados cada mes con salud + trayectoria; **paga el prestamista** (banco/fintech) por el motor; la pyme
  comparte su score (nunca movimientos) con consentimiento explícito, mínimo y revocable, a cambio de crédito más
  barato, más rápido y con aviso previo al recorte; Embat es el canal (coste marginal cero). Cuatro rupturas: de la
  foto al pulso · de castigar a premiar · del corte de grifo al aviso · del banco que juzga a la empresa que se enseña.
  Historia de apertura: "Talleres Velasco" (abril→noviembre; Pulso avisa en julio). Legalidad: compartir datos sin
  permiso no; compartir el score por decisión de la pyme (PSD2/Open Banking, consentimiento, mínimo, revocable) sí.
- Otras ideas valoradas (por si el jurado pregunta): pasaporte financiero verificado, radar de proveedores para
  grandes empresas, seguro de cobro con prima viva, diligencia continua para inversores, índice agregado del pulso pyme.
  Descartadas como producto principal: marketplace (necesita prestamistas en la sala), seguro (sin siniestralidad),
  "score de tu red" (las contrapartes no se comparten entre empresas), agente LLM que aconseja (no se defiende).
- Ante jurado financiero: "esto no existe hoy para una pyme y está medido" convence más que "revolucionario";
  decirlo una vez y luego enseñar números.

**Pendiente para la demo**: tabla de reglas salud/trayectoria → límite y precio; pantalla del prestamista (cartera de
líneas con alertas); pantalla de consentimiento de la pyme; apuntar la URL pública; ensayar el pitch (el brief lo
puntúa). Del compañero (tasks/todo.md): migrar lo que queda del Streamlit al front, "máquina del tiempo" de alertas.

## TellMe (chat con IA) y la clave de Gemini

El navegador llama a `POST /api/ask`; lo atiende `worker/index.js` en Cloudflare, que llama a Gemini
(`gemini-flash-latest`) con `GEMINI_API_KEY` guardada como **secreto del Worker** (`npx wrangler secret put
GEMINI_API_KEY`, ya hecho en producción). La clave nunca va al navegador ni al repo; persiste entre despliegues.
En local: fichero `.dev.vars` (ignorado) con `GEMINI_API_KEY=...` y `npx wrangler dev` (8787; Vite le reenvía `/api`).
Si falla: cambiar el `name` del Worker pierde el secreto (volver a ponerlo); clave revocada → mismo comando;
cuota de Gemini agotada → 429, el resto de la app no depende de él. Nunca poner la clave en el front.
