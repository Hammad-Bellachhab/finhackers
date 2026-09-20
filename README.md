# Embat X-Ray — la salud financiera de cada pyme, mes a mes

Proyecto del equipo **finhackers** para el reto X-Ray de Embat en HackSpain 2026.

**Demo pública:** [https://finhackers.hammad-bellachhab.workers.dev/](https://finhackers.hammad-bellachhab.workers.dev/) · **Vídeo (3 min):** `<URL pendiente>` · Brief del reto: [`docs/reto-embat.md`](docs/reto-embat.md)

## El problema

Todo lo que hoy se mira de una pyme es una foto: cuentas anuales que llegan tarde y ratings que se revisan una vez al
año. Dos empresas con la misma nota hoy pueden venir de sitios opuestos: una de 45 y subiendo, otra de 82 y cayendo.
En la foto son iguales; en seis meses no lo serán. Embat ya ve la tesorería de sus clientes cada día; el reto era
convertir ese rastro en una lectura que capte la **trayectoria**, avise **antes** y se **explique**.

## Qué hemos construido

X-Ray lee 24 meses de tesorería (movimientos bancarios, facturas, financiación y saldos) de 1.286 empresas y, para cada
una y cada mes, responde cuatro cosas:

| | Qué responde | Cómo |
|---|---|---|
| **Cómo está** | Salud de 0 a 100 y banda (sólida · sana · vigilar · riesgo) | Probabilidad de deterioro a 6 meses de un ensemble LightGBM + CatBoost calibrado, suavizada para que un mes malo no la mueva y dos seguidos sí (bache frente a caída) |
| **Hacia dónde va** | Trayectoria (mejorando / estable / deteriorándose) y proyección a 6 meses con banda p10–p90 | Montecarlo empírico: 2.000 trayectorias de meses-empresa que estuvieron en la misma situación |
| **Por qué ha cambiado** | Las señales que han movido el número este mes, y cuándo se vio venir | TreeSHAP por empresa y mes; explicación en lenguaje llano con TellMe |
| **Qué puede hacer** | "Cómo subir tu score": las palancas que lo corrigen, graduables, con el modelo repuntuando en directo | Contrafactuales sobre las métricas de la empresa, puntuados por el mismo modelo |

Encima, un **monitor** que levanta la mano solo (quién se ha movido este mes y por qué) y una vista de **Proveedores**
(bancos y conectores con la salud agregada de sus empresas).

## La demo, pantalla a pantalla

El front es una SPA (React + Vite) que **no llama a ningún servidor de modelo**: el motor precalcula cada respuesta a
JSON (`frontend/public/data/`, generados por `python -m src.pulso`) y Cloudflare los sirve como estáticos. Solo el chat
de TellMe pasa por un Worker que llama a Gemini. Tres rutas por hash:

| Ruta | Qué es |
|---|---|
| `#/` | Portada de Embat: qué hace la plataforma (caja en tiempo real, riesgo a la vista, cierre de mes, pagos), *Conectamos lo que ya tienes* con los bancos y ERP de las 1.286 empresas de la demo y cuántas trae cada uno, TellMe, y la tarjeta de X-Ray como novedad. El logo siempre vuelve aquí. Modo claro y oscuro. |
| `#/xray` | Presentación de X-Ray en tres tarjetas (salud 0–100 · avisa antes · explica cada cambio); el % de deterioros anticipados y la mediana de meses se leen del motor, no están escritos a mano. |
| `#/app` | La demo. La barra tiene dos planos: **Global** (toda la cartera: lo que vería Embat o un prestamista) y **Cliente** (una empresa: lo que vería su tesorero). |

**Global**

| Pestaña | Qué enseña |
|---|---|
| **Cartera** | Arriba, el análisis de TellMe de la cartera (titular, hallazgos con cifras, glosario). Contadores de la cartera (sanas, estables, en riesgo, mejorando, torciéndose) y por banda fina (sólida ≥ 90 · sana ≥ 75 · vigilar ≥ 50 · riesgo < 50). Gráfica de evolución: empresas por banda cada mes y salud media. Tabla de las 1.286 empresas con score, nivel, variación a 3 meses y señal dominante; filtros rápidos *Todas / Mejorando / Torciéndose*, por banda, cohorte de tamaño, orden (más movimiento, mayor caída, mayor mejora, menor o mayor salud) y buscador; modo *Detalle* (variación a 1 mes, señal, P(deterioro a 6 m), grupo, tamaño); un punto marca las empresas que el modelo nunca vio; cada fila despliega el análisis de TellMe. |
| **Alertas** | El monitor completo: el sistema levanta la mano sin que nadie pregunte. Cinco señales que funcionan como filtros: caída estructural · caída brusca este mes · deterioro incipiente · mejora progresiva · excepcionalmente sólida. Por empresa: salud, variación a 1 y 3 meses, *visto antes* y *qué ha cambiado*. |
| **Proveedores** | Los bancos y conectores ERP de la cartera: cuántas empresas y productos tienen, qué tienen colocado, salud media, reparto por banda, cuántas se están torciendo y saldo vivo. Es la vista que un banco tendría de sus clientes si Embat se la enseñara. |
| **Modelo** | La evidencia, para quien quiera comprobarla: la tesis A (solo balance, 30 variables) frente a B (+ comportamiento, 154) con AUC-PR, intervalo bootstrap y peso SHAP del comportamiento; todos los modelos en el holdout; *Anticipación (criterio del reto)* con la distribución de meses de adelanto; *Generalización a empresas no vistas*; estabilidad temporal y calibración; ablación por bloques; importancia global y las 20 variables que más pesan; análisis de errores; diagramas del entrenamiento. |

**Cliente** (buscador por nombre o ID de empresa)

| Sección | Qué enseña |
|---|---|
| **TellMe** | Análisis en lenguaje llano de la empresa (titular, resumen, hallazgos, qué hacer), pregenerado por el motor. Abajo, el chat *Pregúntale a TellMe…* responde con el contexto de la empresa abierta (o de la cartera, en Global). |
| **Pulso** | Salud del mes con variación frente al mes pasado y frente a hace tres; *Qué lo ha movido* (las señales que explican el cambio) y *Sus números* (las métricas de tesorería de la empresa). |
| **Ficha** | Lo básico de la empresa junto a *lo que vería un scoring tradicional solo con balance*; *Qué ha cambiado este mes*; explicación SHAP (rojo empuja el riesgo, verde lo reduce); trayectoria de salud con los meses dentro y fuera de muestra y una cruz donde de verdad se deterioró; series de tesorería (caja y flujos, retrasos de pago, morosidad y descubierto); *Frente a su cohorte*; *¿Y si…?* con escenarios que vuelven a puntuar con el mismo modelo. |
| **Hacia dónde va** | Proyección a 6 meses con banda p10–p90 y de dónde sale (cuántas empresas comparables, cobertura medida); veredicto *bache puntual* o *deterioro estructural*. Si se aplica un plan en *Cómo subir tu score*, la banda entera se desplaza y queda la previsión sin plan en gris. Cuando la empresa tuvo un deterioro, *Cuándo se vio venir*: en qué mes lo detectó el modelo y cuántos meses antes de que fuera evidente. |
| **Cómo subir tu score** | *Qué se lo está bajando* (en puntos de salud, marcando lo que no tiene palanca directa) y *Qué puede hacer*: cada palanca es un slider y se puede descartar; el plan se recalcula con las que queden y termina en *Con este plan su salud pasa de X a Y*, con el techo alcanzable y un pie que explica cómo se ha sumado. Con la API del motor encendida repuntúa el modelo exacto; sin ella, usa la rejilla que el motor precalcula. |
| **Proveedores** | Los bancos y conectores de esa empresa, qué tiene con cada uno y cómo están las demás empresas del mismo banco. |

## Lo que hemos medido

Las cifras completas, con intervalos, están en [`pipeline/README.md`](pipeline/README.md) y `pipeline/reports/`.

- **Generaliza a empresas nunca vistas.** Reservamos 82 empresas desde el principio. En ellas, el modelo que mira el
  comportamiento (B) saca AUC-ROC 0,82 / AUC-PR 0,45 frente a 0,79 / 0,28 del que solo mira el balance (A):
  **+0,16 de AUC-PR [+0,07; +0,25]**. Dentro del entrenamiento, el balance memoriza empresas (0,61 en empresas apartadas)
  y el comportamiento generaliza (0,81).
- **Las dos direcciones.** Se deteriora el 52 % de las empresas marcadas "riesgo", el 26 % de "vigilar", el 5 % de
  "sana" y el 3 % de "sólida". Las "deteriorándose" se deterioran 3 veces más que las "estables" (26 % vs 9 %).
- **Anticipación, medida.** Sobre 243 deterioros reales (definidos sin el modelo), los scores fuera de muestra de un
  modelo congelado a mediados de 2025 anticiparon el 80 %, con una **mediana de 4 meses** de adelanto; 28 % de falsas
  alertas y 16 % de cambios de banda revertidos al mes siguiente.
- **Proyección honesta.** La banda a 6 meses cubre el 81 % de los casos reales en las 82 empresas de test (MAE 4,9 puntos).

## Decisiones que importan

- **No había etiqueta; la definimos.** Deteriorarse = índice de cinco síntomas en los 6 meses siguientes (morosidad
  emergente, caja en negativo, caída de cobros, líneas de crédito al límite, cese de actividad), estandarizado dentro de
  cohortes de tamaño; el 15 % peor es positivo. Probamos 4 variantes: el lift se mantiene.
- **Los saldos y las facturas vencidas eran una foto de hoy, no una serie.** Reconstruimos el saldo de cada mes hacia
  atrás y el estado de cada factura *tal como se veía en ese mes*. Sin eso el modelo habría copiado el futuro.
- **Regla dura anti-fuga.** Nada calculado después del mes T entra como variable. Validación estrictamente temporal con
  embargo de 7 meses (gap + ventana) y 82 empresas apartadas que ningún paso del pipeline ve.
- **Los datos sucios son señal.** Movimientos sin contraparte, meses sin sincronizar el ERP, país no informado: entran
  como features, no se imputan.
- **Todo reproducible bit a bit.** Semilla fija, DuckDB en un hilo, LightGBM determinista: dos ejecuciones desde los CSV
  dan las mismas etiquetas, features y métricas.

## El producto y quién lo paga

**X-Ray es un módulo de Embat.** Embat ya tiene la tesorería conectada de sus clientes; X-Ray la convierte en decisión
sin pedir un dato más, a coste marginal cero. Lo usa el tesorero o CFO de la pyme para saber cómo está, qué se lo está
bajando y qué palanca lo arregla; lo cobra Embat como módulo de su plataforma.

**Lo que abre: Pulso Crédito, la línea de crédito que respira.** Hoy una pyme entrega el mismo dossier a ocho bancos y
recibe un límite fijo que se revisa una vez al año, y el recorte llega sin aviso. Con X-Ray:

- la pyme decide compartir **su score y su trayectoria, nunca sus movimientos**, con su banco o fintech, mediante un
  consentimiento explícito, mínimo y revocable (el mismo marco que Open Banking / PSD2);
- el prestamista recalcula **límite y precio cada mes** a partir de salud + trayectoria, con una tabla de reglas
  pública para la pyme;
- si la salud cae, la pyme recibe el **aviso meses antes del recorte**, con las palancas que lo evitan;
- **paga el prestamista**, porque por primera vez ve el riesgo moverse en vez de una foto anual; Embat es el canal.

Cuatro cambios: de la foto al pulso · de castigar a premiar · del corte de grifo al aviso · del banco que juzga a la
empresa que se enseña.

**Cómo lo llevaríamos a cabo**

1. **Módulo X-Ray dentro de Embat** (lo que hay en esta demo): piloto con clientes actuales, sin integración nueva.
   Se reentrena con datos reales y se valida la etiqueta contra impagos y descubiertos observados.
2. **Consentimiento y tabla de reglas**: pantalla en la que la pyme elige qué comparte (score, trayectoria, alertas),
   con quién y hasta cuándo; reglas salud + trayectoria → límite y precio, publicadas.
3. **Piloto con un prestamista** (fintech de circulante o banco con línea pyme): panel de cartera de líneas con alertas,
   medición de mora y de recortes evitados frente a su proceso actual.
4. **Escala**: el motor es el mismo para todas las pymes de Embat; cada prestamista nuevo es un contrato, no un desarrollo.

## Cómo usarlo

Requisitos: Node 22 (Vite 8 necesita 20.19 o superior), Python 3.12+, Git LFS (solo para reproducir el motor).

### 1. Probar el front en local (sin motor)

El front lee datos precalculados de `frontend/public/data/` (en git), así que arranca sin Python:

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Las rutas y pantallas están descritas en [La demo, pantalla a pantalla](#la-demo-pantalla-a-pantalla). Sin el Worker,
TellMe enseña los análisis pregenerados; el chat libre necesita el paso 4.

### 2. Reproducir el motor de scoring

```bash
git lfs pull                                       # invoices.csv y transactions.csv (data/raw/)
cd pipeline
pip install -r requirements.txt
python -m src.pipeline all                         # ≈ 10 min: CSV → panel → etiqueta → features → modelos → SHAP → BD → test → proyección
python -m src.pulso                                # regenera frontend/public/data/ (≈ 4 min)
python -m pytest -q tests                          # unitarios + smoke end-to-end con datos sintéticos (~3 min)
```

Cada paso se puede lanzar por separado (`python -m src.pipeline train evaluate`); también hay `Makefile` y
`docker-compose.yml`. Opcionales: `python -m uvicorn src.api.main:app --port 8000` (API FastAPI, `/docs`) y
`python -m streamlit run src/frontend/app.py` (dashboard de referencia).

### 3. Puntuar empresas nuevas (test oculto)

```bash
cd pipeline
python -m src.predict --raw <carpeta_con_los_csv> --out <carpeta_salida>
```

Aplica el modelo servido sin reentrenar y escribe predicciones, salud, trayectoria y explicaciones por empresa.

### 4. TellMe (chat) en local

El chat lo atiende un Cloudflare Worker (`worker/index.js`) que llama a Gemini con una clave que nunca llega al navegador.
En local: crear `.dev.vars` en la raíz con `GEMINI_API_KEY=...` y lanzar `npx wrangler dev` (puerto 8787; Vite le
reenvía `/api`).

### Despliegue

Todo estático en Cloudflare (`wrangler.jsonc`): cada push a `main` construye el front y lo publica junto con los JSON
precalculados. Tras cambiar datos o modelo: `python -m src.pipeline all` → `python -m src.pulso` → commit + push.

## Estructura del repo

```
data/raw/            los CSV del reto (invoices y transactions por Git LFS)
pipeline/            motor de scoring en Python — pipeline/README.md tiene toda la metodología y las cifras
  src/               ingest → schema (DuckDB) → split_test → labels → features → train → evaluate → serve_db → projection
  reports/           métricas, anticipación, backtest de la proyección, figuras
  models/registry/   metadata del modelo servido
frontend/            SPA React + Vite + TypeScript (landing, cartera, alertas, proveedores, modelo, empresa, TellMe)
  public/data/       JSON precalculados por python -m src.pulso (contrato en src/api/types.ts)
worker/index.js      Cloudflare Worker: sirve el front y POST /api/ask (TellMe → Gemini)
docs/                brief, diccionario de datos, paleta, specs de diseño, guión del vídeo
tasks/               lista de tareas y lecciones del equipo
```

## Límites que declaramos

El dataset es sintético y la etiqueta es una construcción nuestra, documentada y sometida a sensibilidad. Los ceses
súbitos de actividad son los deterioros que peor se anticipan (46 % de los falsos negativos). El accuracy (~86 %) engaña
con un 15 % de positivos: por eso reportamos AUC-PR e intervalos por bootstrap, no decimales. Pulso Crédito está
definido y con comprador, pero las pantallas del prestamista y del consentimiento no están en esta demo.

## Equipo

finhackers: Diego Rodríguez Díaz del Campo, Hammad Bellachhab, Héctor Sanuni y Felipe Arche. <!-- TODO: roles -->
Hecho en el fin de semana de HackSpain 2026.
