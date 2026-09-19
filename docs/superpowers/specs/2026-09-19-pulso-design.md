# Pulso — diseño

*Reto X-Ray de Embat, HackSpain 2026. Revisado el 2026-09-19.*

Un score de salud financiera y, encima, dos superficies con el mismo motor detrás:

- **Pulso Empresa** — lo que ve una empresa sobre sí misma: su score, su previsión y qué
  decisiones tomar.
- **Pulso Cartera** — la vista de conjunto sobre las 1.286 empresas: quién está sano, quién
  mejora, quién se tuerce.

## 1. Por qué dos partes

Las seis preguntas del reto se reparten en dos planos y ninguna superficie sola las contesta:

- *Quién está sano*, *quién está mejorando*, *quién empieza a torcerse* son preguntas sobre el
  **conjunto**. Una ficha individual no las responde, por buena que sea.
- *Por qué ha cambiado*, *cuándo se vio venir* y *bache o caída* son preguntas sobre **una
  empresa**. Una tabla de 1.286 filas no las responde.

Además, el test oculto de 60-80 empresas —lo que puntúa el leaderboard— solo se puede
enseñar en la vista de conjunto. Sin ella, la generalización se queda en un slide.

## 2. Restricciones

1. **Embat ya tiene el panel de tesorería**: posición de caja, previsión de liquidez,
   conciliación con IA, pagos, netting. Replicar cualquiera de esas cosas resta.
2. **Nada de monetización en pantalla.** Sin paywalls ni planes. El comprador se responde en
   una frase del pitch: lo paga la empresa, lo cobra Embat como módulo nuevo, y el coste
   marginal para Embat es cero porque los datos ya los tiene.
3. **El front va primero contra mock**, con el contrato de API cerrado. El motor se cablea
   después sin tocar componentes.

## 3. El eje: puntuación → predicción → decisión

**Puntuación.** Nivel y trayectoria, dos ejes independientes. El ejemplo del brief lo exige:
Velasco cae de 82 a 68 y *sigue pareciendo sana*. Nivel `healthy`, tendencia `down`.
Colapsarlos en una etiqueta pierde justo la lectura que el reto pide.

**Predicción.** Proyección **determinista** a 3 y 6 meses: mismo input, mismo output, sin
aleatoriedad. Reproducible delante del jurado. Se proyecta el score y también las métricas que
lo mueven.

**Decisión.** Cada predicción se convierte en una palanca con regla de disparo, acción concreta
e impacto estimado en euros y en puntos de score. Reglas deterministas, no un modelo de
lenguaje improvisando consejos.

## 4. Aviso sobre el scoring de crédito

El estándar del sector es el **Altman Z-score** (`Z = 1.2·X₁ + 1.4·X₂ + 3.3·X₃ + 0.6·X₄ +
1.0·X₅`, zona de peligro por debajo de 1.81). **No es calculable con este dataset**: sus cinco
ratios necesitan balance y cuenta de resultados —activo total, reservas, EBIT, fondos propios,
ventas— y aquí solo hay flujos. Se documenta para que nadie lo intente a mitad del sábado.

Lo que sí se calcula, y sirve a la vez de feature del modelo y de palanca de decisión:

| Métrica | De dónde sale | Referencia |
|---|---|---|
| **DSO** — días en cobrar | `invoices` emitidas: emisión → cobro | su propia mediana de 12 m |
| **DPO** — días en pagar | `invoices` recibidas | ídem |
| **Ciclo de caja** | DSO − DPO (no hay inventario, así que sin DIO) | cuanto más corto, mejor |
| **DSCR** — cobertura del servicio de deuda | flujo operativo ÷ cuota (`debt_schedule_config`) | **≥ 1,25**; la banca exige 1,1–1,5 |
| **Días de caja** | saldo ÷ quema mensual | < 60 días = tensión |
| **Uso de líneas** | `outstanding` ÷ `granted` (`debt_products`) | > 80 % = señal clásica de estrés |
| **Concentración de clientes** | cobros por `counterparty_id` | un cliente > 30 % = frágil |
| **Puntualidad propia** | facturas recibidas pagadas tarde | se deteriora antes que la caja |

## 5. Pulso Empresa

Una sola vista con tres secciones, sin navegación intermedia: en una demo, cada clic es una
oportunidad de perder al jurado.

### 5.1 Pulso

El score como **línea de 24 meses**, nunca un número suelto. Nivel, tendencia, delta a 1 y a 3
meses. Debajo, los drivers que lo movieron, cada uno con su señal, su dirección y **la fecha en
que empezó a moverse**.

> Contesta: *por qué ha cambiado* (pregunta 5), *trayectoria*.

### 5.2 Previsión

Proyección determinista a 3 y 6 meses con banda de incertidumbre, y dos piezas más:

- **Cuándo se vio venir**: diagrama que enfrenta el mes en que el sistema detectó el cambio
  contra el mes en que fue evidente en los números, con la distancia anotada en meses.
- **Bache o deterioro**: distintivo explícito. El aviso de *"es un bache, no actúes"* vale
  tanto como la alarma — evita romper una relación comercial sana o refinanciar sin necesidad.

> Contesta: *cuándo se vio venir* (6), *bache o caída* (4), *anticipación*, *estabilidad*.

### 5.3 Decisiones

Palancas ordenadas por impacto en euros. Cada una es determinista: una regla de disparo, una
acción y un impacto estimado.

| Palanca | Se dispara cuando | Acción | Impacto |
|---|---|---|---|
| Acelerar cobro | DSO > mediana 12 m + 10 d | descuento por pronto pago, recordatorios, factoring | libera caja atrapada |
| Estirar pago | DPO por debajo de su histórico y caja tensa | renegociar plazos con proveedores | libera caja |
| Refinanciar | DSCR < 1,25 | alargar plazo o bajar tipo | devuelve DSCR sobre el umbral |
| Amortizar deuda cara | días de caja holgados y tipo alto | amortización anticipada | baja gasto financiero |
| Ampliar línea | días de caja < 60 | abrir o ampliar línea de crédito | colchón antes de necesitarlo |
| Bajar uso de líneas | dispuesto/concedido > 80 % | reducir disposición | quita una señal de estrés |
| Diversificar | un cliente > 30 % de cobros | buscar contrapartes | baja riesgo de concentración |
| Pagar a tiempo | facturas propias pagadas tarde | priorizar pagos | frena el deterioro antes de que llegue a la caja |

Sobre *estirar pago*: la literatura avisa de que forzar el DPO daña la relación con
proveedores y acaba en peores precios o plazos más duros. La palanca lleva ese aviso; no se
recomienda a ciegas.

**El simulador** es la pieza de demo: se mueve el DSO y la proyección del score responde en
vivo. Determinista por construcción, explicable, y enseña el modelo funcionando sin una sola
transparencia.

> Contesta: *producto encima del score*.

## 6. Pulso Cartera

Las 1.286 empresas en una vista.

- **Tres respuestas de un vistazo**: quién está sano, quién está mejorando, quién empieza a
  torcerse. Mejora y deterioro con **idéntico peso visual** — nada de semáforo de riesgo, que
  sesgaría hacia una sola cara.
- **El test oculto va marcado.** Las 60-80 empresas que el modelo nunca vio se distinguen en
  la propia tabla. Así la generalización se ve, no se afirma.
- Orden por nivel o por movimiento; filtro por banda y por dirección.
- **Monitor**: las alertas aparecen solas, sin que nadie pregunte. Cada una dice qué se movió,
  cuánto, y cuántos meses antes se detectó.
- **Evidencia**: rendimiento sobre el holdout, anticipación mediana en meses, y las dos caras
  medidas por separado. Es lo que casi todos dejan en slides.

> Contesta: *quién está sano* (1), *quién mejora* (2), *quién se tuerce* (3),
> *generalización*, *las dos caras*, *monitor*.

## 7. Trazabilidad completa

| Lo que se mira | Dónde se ve |
|---|---|
| 1. Quién está sano | Cartera |
| 2. Quién está mejorando | Cartera |
| 3. Quién empieza a torcerse | Cartera (nivel alto + tendencia a la baja) |
| 4. Bache o caída | Empresa · Previsión |
| 5. Por qué ha cambiado | Empresa · Pulso (drivers con fecha) |
| 6. Cuándo se vio venir | Empresa · Previsión |
| Generalización | Cartera (marca de holdout) + Evidencia |
| Trayectoria | Ambas: el score siempre es una línea |
| Las dos caras | Cartera, con igual peso visual |
| Anticipación medida | Empresa · Previsión + Evidencia |
| Estabilidad | Empresa · Previsión |
| Monitor (bonus) | Cartera |
| Explicación | Empresa · Pulso |
| Producto | Empresa · Decisiones |
| Comprador | Una frase del pitch, no ocupa pantalla |
| Artesanía | Tres estados por vista, claro/oscuro, build verde |

## 8. Contrato de API

Los mock viven en `frontend/src/api/mock/` **detrás de la misma firma** que la API real:
cablear el motor es cambiar una constante, no reescribir vistas.

```ts
type Band = 'healthy' | 'stable' | 'risk'      // nivel: dónde está hoy
type Trend = 'up' | 'down' | 'flat'            // trayectoria: hacia dónde va

type ScorePoint = { month: string; score: number }        // 'YYYY-MM'

type Driver = {
  id: string
  label: string          // "El cobro se alarga"
  direction: Trend
  impact: number         // puntos de score, con signo
  since: string          // 'YYYY-MM': cuándo empezó a moverse
  detail: string
}

type Metric = {
  id: 'dso' | 'dpo' | 'ccc' | 'dscr' | 'cash_days' | 'credit_usage' | 'concentration'
  label: string
  value: number
  unit: 'days' | 'ratio' | 'pct'
  reference: number      // umbral o mediana propia
  status: 'ok' | 'watch' | 'breach'
}

// ---------- Pulso Empresa ----------

// GET /api/companies/{id}/score
type CompanyScore = {
  companyId: string
  name: string
  score: number          // 0-100
  band: Band
  trend: Trend
  delta1m: number
  delta3m: number
  series: ScorePoint[]   // 24 puntos
  drivers: Driver[]
  metrics: Metric[]
  heldOut: boolean       // el modelo no la vio nunca
}

// GET /api/companies/{id}/forecast
type Forecast = {
  companyId: string
  horizon: ScorePoint[]              // proyección a 3 y 6 meses
  bandLow: ScorePoint[]              // incertidumbre
  bandHigh: ScorePoint[]
  stability: 'dip' | 'structural'    // bache o deterioro
  stabilityNote: string              // "es un bache, no actúes"
  detection: {
    detectedAt: string               // cuándo lo vio el sistema
    evidentAt: string                // cuándo fue evidente en los números
    monthsAhead: number
  } | null
}

// GET /api/companies/{id}/decisions
type Decision = {
  id: string
  lever: 'collect_faster' | 'pay_slower' | 'refinance' | 'amortise'
       | 'open_credit_line' | 'reduce_usage' | 'diversify' | 'pay_on_time'
  title: string          // "Acelera el cobro"
  rationale: string      // la regla que la disparó, en lenguaje humano
  metricId: Metric['id']
  currentValue: number
  targetValue: number
  cashImpact: number     // euros liberados o ahorrados
  scoreImpact: number    // puntos de score a 3 meses
  caution: string | null // p. ej. el aviso sobre forzar el DPO
}

// POST /api/companies/{id}/simulate   body: { metricId, value }
type Simulation = {
  metricId: Metric['id']
  value: number
  projected: ScorePoint[]
  scoreDelta: number
  cashDelta: number
}

// ---------- Pulso Cartera ----------

// GET /api/portfolio
type PortfolioRow = {
  companyId: string
  name: string
  score: number
  band: Band
  trend: Trend
  delta3m: number
  heldOut: boolean
  topDriver: string      // la señal dominante, para la tabla
}
type Portfolio = {
  rows: PortfolioRow[]
  counts: { healthy: number; stable: number; risk: number
            improving: number; slipping: number; heldOut: number }
}

// GET /api/alerts
type Alert = {
  id: string
  companyId: string
  companyName: string
  kind: 'improving' | 'slipping'
  score: number
  delta: number
  monthsAhead: number | null
  message: string
  createdAt: string      // ISO
}

// GET /api/evidence
type Evidence = {
  holdout: { companies: number; auc: number; spearman: number }
  anticipation: { medianMonths: number; p25: number; p75: number; detected: number }
  bothDirections: { improvingRecall: number; slippingRecall: number }
  stability: { dipsCorrectlyIgnored: number; structuralCaught: number }
}
```

**Nota de datos**: el dataset no trae nombres de empresa, solo IDs. Hace falta una capa de
nombres legibles y estables por `company_id`; un ID crudo en pantalla arruina la demo.

## 9. Arquitectura del front

```
frontend/src/
  api/          index.ts (fachada), types.ts, mock/
  company/      Pulso Empresa: pulse/, forecast/, decisions/
  portfolio/    Pulso Cartera: tabla, monitor, evidence/
  shared/       ScoreLine, BandBadge, TrendArrow, Money, Metric,
                Empty / Error / Skeleton
  styles/       tokens.css (paleta de Embat)
```

**Gráficas**: Recharts para las series de 24 meses y la proyección. **SVG propio** para el
diagrama de anticipación — es la pieza que tiene que impresionar y no sale de una librería.

**Colores**: solo tokens semánticos, nunca hex. Los tokens de banda actuales mezclan nivel y
trayectoria; hay que alinearlos con la separación de la sección 8:
`--color-band-healthy|stable|risk` para el nivel y `--color-trend-up|down|flat` para la
dirección. El nivel se pinta como relleno de la insignia; la tendencia, como flecha.

## 10. Estados y errores

Cada vista implementa sus **tres estados desde el principio**: cargando (esqueleto, no
spinner), vacío (con texto útil) y fallo (con el error y un reintento).

En una demo ante jurado, una pantalla en blanco por un fetch caído cuesta más que cualquier
error del modelo. El front nunca debe depender de que el motor esté vivo para pintar algo.

## 11. Verificación

- `npm run build` (typecheck + build) verde en cada paso.
- Captura de cada pantalla en claro y oscuro, mirada de verdad, no asumida.
- Recorrido completo de la demo **con el motor apagado**, para probar los estados de fallo.

## 12. Fuera de alcance

- **Previsión de caja y conciliación**: es el producto actual de Embat.
- **Paywall, planes y cobros**: el comprador se explica hablando.
- **Autenticación real**: no hay usuarios.
