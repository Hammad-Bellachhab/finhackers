# 06 · Model Specification

Responsable: **Diego**. Borrador inicial: Diego lo cierra en T0.4 y lo versiona aquí.
Principio del reto: *un modelo sencillo con un producto claro encima interesa más que uno sofisticado
que se queda en el número*. Por eso V0 es una scorecard sin entrenamiento y V1 solo la sustituye si gana.

## 1. Qué sale

Por empresa y mes (`company_id`, `T`):

| Campo | Qué es |
|---|---|
| `score` | salud 0-100 (**alto = sano**), combinación de nivel y trayectoria |
| `level` | 0-100, dónde está hoy frente a la cartera |
| `trajectory` | 0-100, hacia dónde va (50 = estable) |
| `band` | `sólida` > 65 · `vigilancia` 35-65 · `débil` < 35 (umbrales iniciales; se cierran con Héctor en T3.3) |
| `momentum` | `mejorando` / `estable` / `deteriorando` (M2 del catálogo) |
| `persistence` | `bache` / `caída estructural` / `mejora sostenida` (M3) |
| `delta_1m`, `percentile` | variación mensual y posición en la cartera |
| `confidence` | `baja` si < 6 meses de historia o < 2 pilares con dato |
| `top_factors` | 3 contribuciones con signo + frase en lenguaje natural |
| `model_version` | versión |

`sector` **no existe en los datos** (ver 01): el front no lo muestra o lo marca "no disponible".

## 2. Target

No hay desenlace en el dataset. Dos niveles de verdad:

1. **Ground truth del leaderboard** (organización). Es la verdad que puntúa. Formato, métrica y si las 60-80
   empresas del test oculto están dentro o fuera de las 1.286: **DESCONOCIDO → T0.2 (P0)**.
2. **Proxies internos (ESTIMATED)**, para validar y probar hipótesis mientras tanto. Medidos en T+1…T+6;
   T etiquetable ≤ 2026-02:

| ID | Proxy | Definición | Dirección |
|---|---|---|---|
| O1 | Cambio de salud cruda | media de z-scores (por cohorte de tamaño) de: vencidas abiertas a pagar, meses con caja < 0, variación de cobros, meses inactivos — ventana de resultado menos ventana de observación | **ambas** (continuo) |
| O2 | Deterioro de pagos | F01 en T+6 − F01 en T | deterioro |
| O3 | Tensión de caja | meses con `cash_eom` < 0 en T+1…T+6 | deterioro |
| O4 | Cese | ≥ 2 meses seguidos sin movimientos en T+1…T+6, con actividad previa | deterioro |
| O5 | Cobros | media de cobros T+1…T+6 frente a T−5…T: caída > 40 % / subida > 40 % | ambas |

Etiquetas binarias para AUC: **deterioro** = O1 en el 15 % peor; **mejora** = O1 en el 15 % mejor.
Los proxies usan las mismas magnitudes que algunas features pero en otra ventana temporal: está permitido,
es exactamente "el DPD de hoy predice el de dentro de seis meses". Se declara en la demo que son proxies.

## 3. Split y referencia

- Validación cruzada **por `group_id`** (5 folds, semilla fija, T1.4). Nunca por empresa.
- Si el test oculto está dentro de las 1.286, sus grupos se excluyen de todo (incluidas las tablas de referencia).
- Los percentiles se calculan contra **tablas de referencia construidas solo con train** (T2.4): a una
  empresa no vista se le interpola en la tabla; nunca se recalculan percentiles incluyéndola.
- Anticipación y proxies: solo T ≤ 2026-02.

## 4. V0 — scorecard (sin entrenamiento)

1. Features V0 del catálogo: F01, F02, F04, F09, F12, F13, F21, F23, F25, F26, F27.
2. Winsorizar p1-p99 (cortes de la referencia).
3. Percentil de cada feature en su mes T contra la referencia; orientado (si "↑ es −", 100 − pct).
4. Pilares = media de los percentiles disponibles del pilar:

| Pilar | Features | Peso previo | De dónde sale |
|---|---|---|---|
| Pago | F01, F02, F04 | 30 | FICO A (35) |
| Liquidez | F21, F23, F25, F26 | 25 | no existe en FICO; es lo que Embat ve |
| Cobro e ingresos | F09, F12, F13 | 25 | idem |
| Deuda | F27 | 20 | FICO B (30), solo parcialmente observable |

   FICO C, D y E (35 puntos) son MISSING o ESTIMATED débiles para empresas: su peso se reparte hacia
   liquidez y cobros. **Los pesos son un prior de juicio experto** (como Altman Z-Score antes de tener
   datos), no una verdad: V1 los reemplaza si los datos dan otros mejores.
5. `level` = Σ peso × pilar / Σ pesos disponibles.
6. `trajectory` = percentil transversal (mes T) de la pendiente de `level` en 6 meses (≥ 3 puntos).
7. `score` = α · `level` + (1 − α) · `trajectory`, **α = 0,5** inicial, se ajusta en T5.3.
8. `top_factors`: contribución_k = (peso del pilar / nº features del pilar) × (percentil orientado_k − 50).
   Las 3 de mayor valor absoluto. El "por qué cambió" es Δ contribución_k frente a T−1.

## 5. V1 — pesos aprendidos (solo si gana)

- Regresión (logística u ordinal) de los desenlaces sobre los percentiles orientados, **coeficientes ≥ 0**
  para conservar el sentido y la explicabilidad.
- Contraste opcional (P2): LightGBM con restricciones monótonas + SHAP.
- Contra leaderboard: pocas submissions y solo ajustes gruesos (α, pesos de pilar) para no sobreajustarlo.
- **Regla**: V1 sustituye a V0 solo si mejora la métrica principal en CV por grupo con IC 95 % que no
  cruza 0 **y** no empeora el leaderboard.

## 6. Métricas

| Bloque del reto | Métrica | Cómo |
|---|---|---|
| Si acierta · generalización | métrica del leaderboard | T0.2 |
| | Spearman(`score` en T, O1) | media por T, CV por grupo |
| Si acierta · las dos caras | AUC deterioro (score bajo) y AUC mejora (trajectory alta) | se reportan las dos y su diferencia |
| Si acierta · trayectoria | Spearman de `trajectory` con O1 frente al de `level` | la trayectoria debe aportar sobre el nivel |
| Si llega a tiempo · anticipación | meses de adelanto | para cada evento (O3/O4 o caída de O1), meses entre el primer `deteriorando` persistente y el evento; mediana y distribución |
| Si llega a tiempo · estabilidad | % de caídas ≥ 10 puntos que se revierten en ≤ 2 meses | falsos baches |
| Si llega a tiempo · monitor | precisión de las alertas | alerta = `caída estructural` o `mejora sostenida` |
| Calibración | Brier / curva | solo si V1 devuelve probabilidad |

## 7. Checklist anti-fuga (Diego lo firma antes de cada submission)

- [ ] Ninguna feature en T < corte usa `status`, `pending_amount`, `balances.*`, `granted`, `outstanding` directamente.
- [ ] Test T2.3 en verde.
- [ ] Split por grupo; ningún `group_id` en dos folds.
- [ ] Referencias de percentiles y winsorización calculadas solo con train.
- [ ] F36 (score de hermanas) solo con split por grupo.
- [ ] Proxies solo con T ≤ 2026-02.
