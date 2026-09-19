# Pulso — plan de implementación del front

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir las dos superficies de Pulso —Empresa y Cartera— contra datos mock, detrás del contrato de API, de modo que cablear el motor sea cambiar una constante.

**Architecture:** React + Vite + TypeScript. Una fachada en `src/api/index.ts` expone las siete funciones del contrato; hoy resuelven contra un generador mock determinista, mañana contra HTTP. Los componentes solo conocen la fachada y los tipos, nunca el origen de los datos. Dos superficies (`company/`, `portfolio/`) sobre primitivas compartidas en `shared/`.

**Tech Stack:** React 19.3, Vite 8.3, TypeScript 6, Recharts 3.10 (declara soporte de React 19), Vitest + Testing Library, jsdom.

**Spec:** `docs/superpowers/specs/2026-09-19-pulso-design.md`

## Global Constraints

- **Colores**: solo tokens semánticos de `src/styles/tokens.css`. Nunca un hex literal en un componente, o se rompe el modo oscuro.
- **Nivel y trayectoria son ejes independientes**: `band` es `'healthy' | 'stable' | 'risk'`, `trend` es `'up' | 'down' | 'flat'`. No se colapsan en una sola etiqueta.
- **Nada de monetización en pantalla**: sin paywalls, planes ni cobros.
- **Determinismo**: el mock genera los mismos datos ante la misma semilla. Es requisito del reto y condición para que los tests no parpadeen.
- **Tres estados por vista**: cargando, vacío y fallo. El front pinta algo aunque el motor esté apagado.
- **Gráficas dinámicas**: las escalas se derivan de los datos recibidos. Nada de rangos fijos ni imágenes; tienen que aguantar los datos reales del motor.
- **Idioma de la interfaz**: español, con acentos correctos.

---

### Task 1: Infraestructura de pruebas y tipos del contrato

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.ts`
- Create: `frontend/src/api/types.ts`
- Create: `frontend/src/api/types.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: todos los tipos del contrato (`Band`, `Trend`, `ScorePoint`, `Driver`, `Metric`, `CompanyScore`, `Forecast`, `Decision`, `Simulation`, `PortfolioRow`, `Portfolio`, `Alert`, `Evidence`) y el guard `isBand`. Todas las tareas siguientes importan de aquí.

- [ ] **Step 1: Instalar las dependencias de prueba y de gráficas**

```bash
cd frontend
npm install recharts@^3.10.1
npm install -D vitest@^4 @vitest/coverage-v8@^4 jsdom@^28 @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/user-event@^14
```

- [ ] **Step 2: Añadir el script de test a `package.json`**

En `"scripts"`, junto a los existentes:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Configurar Vitest en `vite.config.ts`**

Reemplaza el contenido completo. Importa de `vitest/config`, no de `vite`, para que el campo `test` tenga tipos:

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // El front llama a /api/... y Vite lo reenvia al backend en desarrollo.
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

- [ ] **Step 4: Crear el fichero de setup de pruebas**

`frontend/src/test-setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 5: Escribir el test que falla**

`frontend/src/api/types.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isBand, type CompanyScore } from './types'

describe('contrato de la API', () => {
  it('reconoce las tres bandas de nivel y rechaza las trayectorias', () => {
    expect(isBand('healthy')).toBe(true)
    expect(isBand('stable')).toBe(true)
    expect(isBand('risk')).toBe(true)
    // 'improving' es trayectoria, no nivel: no debe colarse como banda
    expect(isBand('improving')).toBe(false)
  })

  it('un CompanyScore separa nivel de trayectoria', () => {
    const velasco: CompanyScore = {
      companyId: 'c-1', name: 'Velasco Industrial',
      score: 68, band: 'healthy', trend: 'down',
      delta1m: -3, delta3m: -9,
      series: [{ month: '2026-09', score: 68 }],
      drivers: [], metrics: [], heldOut: false,
    }
    // El ejemplo del brief: cae de 82 a 68 y sigue pareciendo sana.
    expect(velasco.band).toBe('healthy')
    expect(velasco.trend).toBe('down')
  })
})
```

- [ ] **Step 6: Ejecutar el test y verificar que falla**

Run: `npm test -- src/api/types.test.ts`
Expected: FAIL — "Failed to resolve import './types'"

- [ ] **Step 7: Escribir `src/api/types.ts`**

```ts
/** Contrato de la API. Seccion 8 de la spec.
 *  Nivel y trayectoria son ejes independientes: una empresa puede tener
 *  nivel 'healthy' y tendencia 'down' (el caso Velasco del brief). */

export type Band = 'healthy' | 'stable' | 'risk'
export type Trend = 'up' | 'down' | 'flat'

const BANDS: readonly string[] = ['healthy', 'stable', 'risk']
export function isBand(value: string): value is Band {
  return BANDS.includes(value)
}

export type ScorePoint = { month: string; score: number } // month: 'YYYY-MM'

export type Driver = {
  id: string
  label: string
  direction: Trend
  impact: number // puntos de score, con signo
  since: string // 'YYYY-MM': cuando empezo a moverse
  detail: string
}

export type MetricId =
  | 'dso' | 'dpo' | 'ccc' | 'dscr' | 'cash_days' | 'credit_usage' | 'concentration'

export type Metric = {
  id: MetricId
  label: string
  value: number
  unit: 'days' | 'ratio' | 'pct'
  reference: number
  status: 'ok' | 'watch' | 'breach'
}

export type CompanyScore = {
  companyId: string
  name: string
  score: number
  band: Band
  trend: Trend
  delta1m: number
  delta3m: number
  series: ScorePoint[]
  drivers: Driver[]
  metrics: Metric[]
  heldOut: boolean
}

export type Forecast = {
  companyId: string
  horizon: ScorePoint[]
  bandLow: ScorePoint[]
  bandHigh: ScorePoint[]
  stability: 'dip' | 'structural'
  stabilityNote: string
  detection: { detectedAt: string; evidentAt: string; monthsAhead: number } | null
}

export type LeverId =
  | 'collect_faster' | 'pay_slower' | 'refinance' | 'amortise'
  | 'open_credit_line' | 'reduce_usage' | 'diversify' | 'pay_on_time'

export type Decision = {
  id: string
  lever: LeverId
  title: string
  rationale: string
  metricId: MetricId
  currentValue: number
  targetValue: number
  cashImpact: number
  scoreImpact: number
  caution: string | null
}

export type Simulation = {
  metricId: MetricId
  value: number
  projected: ScorePoint[]
  scoreDelta: number
  cashDelta: number
}

export type PortfolioRow = {
  companyId: string
  name: string
  score: number
  band: Band
  trend: Trend
  delta3m: number
  heldOut: boolean
  topDriver: string
}

export type Portfolio = {
  rows: PortfolioRow[]
  counts: {
    healthy: number; stable: number; risk: number
    improving: number; slipping: number; heldOut: number
  }
}

export type Alert = {
  id: string
  companyId: string
  companyName: string
  kind: 'improving' | 'slipping'
  score: number
  delta: number
  monthsAhead: number | null
  message: string
  createdAt: string
}

export type Evidence = {
  holdout: { companies: number; auc: number; spearman: number }
  anticipation: { medianMonths: number; p25: number; p75: number; detected: number }
  bothDirections: { improvingRecall: number; slippingRecall: number }
  stability: { dipsCorrectlyIgnored: number; structuralCaught: number }
}
```

- [ ] **Step 8: Ejecutar el test y verificar que pasa**

Run: `npm test -- src/api/types.test.ts`
Expected: PASS, 2 tests

- [ ] **Step 9: Verificar que el build sigue verde**

Run: `npm run build`
Expected: compila sin errores de tipos

- [ ] **Step 10: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.ts frontend/src/test-setup.ts frontend/src/api/
git commit -m "Añade Vitest y los tipos del contrato de la API"
```

---

### Task 2: Generador mock determinista

**Files:**
- Create: `frontend/src/api/mock/rng.ts`
- Create: `frontend/src/api/mock/rng.test.ts`
- Create: `frontend/src/api/mock/names.ts`
- Create: `frontend/src/api/mock/dataset.ts`
- Create: `frontend/src/api/mock/dataset.test.ts`

**Interfaces:**
- Consumes: los tipos de `src/api/types.ts`.
- Produces: `makeRng(seed: number): () => number`; `companyName(id: string): string`; `buildDataset(): MockCompany[]` y `type MockCompany = { score: CompanyScore; forecast: Forecast; decisions: Decision[] }`. La Task 3 consume `buildDataset`.

- [ ] **Step 1: Escribir el test que falla del PRNG**

`frontend/src/api/mock/rng.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { makeRng } from './rng'

describe('makeRng', () => {
  it('produce la misma secuencia con la misma semilla', () => {
    const a = makeRng(42)
    const b = makeRng(42)
    const seqA = [a(), a(), a(), a(), a()]
    const seqB = [b(), b(), b(), b(), b()]
    expect(seqA).toEqual(seqB)
  })

  it('produce secuencias distintas con semillas distintas', () => {
    const a = makeRng(1)
    const b = makeRng(2)
    expect(a()).not.toBe(b())
  })

  it('devuelve valores en [0, 1)', () => {
    const r = makeRng(7)
    for (let i = 0; i < 200; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- src/api/mock/rng.test.ts`
Expected: FAIL — no existe `./rng`

- [ ] **Step 3: Implementar el PRNG**

`frontend/src/api/mock/rng.ts`:

```ts
/** PRNG con semilla (mulberry32). Determinista a proposito: el reto pide
 *  predicciones reproducibles, y ademas evita que los tests parpadeen. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm test -- src/api/mock/rng.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 5: Crear el generador de nombres**

`frontend/src/api/mock/names.ts`. El dataset real solo trae IDs; un ID crudo en pantalla arruina la demo.

```ts
import { makeRng } from './rng'

const FIRST = [
  'Northbrook', 'Velasco', 'Almenar', 'Duero', 'Sagrera', 'Montalbán', 'Ribera',
  'Castaño', 'Peñalba', 'Hontoria', 'Aranzazu', 'Bellver', 'Corvera', 'Esparza',
  'Frontera', 'Guadaira', 'Íllora', 'Jarama', 'Lastres', 'Miranda',
]
const SECOND = [
  'Foods', 'Industrial', 'Logística', 'Textil', 'Metales', 'Química', 'Agro',
  'Servicios', 'Construcción', 'Distribución', 'Electrónica', 'Papelera',
]
const SUFFIX = ['S.L.', 'S.A.', 'Group', '']

/** Nombre estable y legible para un id. El mismo id da siempre el mismo nombre. */
export function companyName(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const r = makeRng(h)
  const parts = [
    FIRST[Math.floor(r() * FIRST.length)],
    SECOND[Math.floor(r() * SECOND.length)],
    SUFFIX[Math.floor(r() * SUFFIX.length)],
  ]
  return parts.filter(Boolean).join(' ')
}
```

- [ ] **Step 6: Escribir el test que falla del dataset**

`frontend/src/api/mock/dataset.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildDataset } from './dataset'

describe('buildDataset', () => {
  const data = buildDataset()

  it('genera 1286 empresas, como el dataset real', () => {
    expect(data).toHaveLength(1286)
  })

  it('es determinista entre llamadas', () => {
    const otra = buildDataset()
    expect(otra[0].score.score).toBe(data[0].score.score)
    expect(otra[500].score.name).toBe(data[500].score.name)
  })

  it('cada empresa tiene 24 meses de historia y un score en rango', () => {
    for (const c of data.slice(0, 50)) {
      expect(c.score.series).toHaveLength(24)
      expect(c.score.score).toBeGreaterThanOrEqual(0)
      expect(c.score.score).toBeLessThanOrEqual(100)
    }
  })

  it('separa nivel de trayectoria: hay empresas sanas que estan cayendo', () => {
    const torciendose = data.filter((c) => c.score.band === 'healthy' && c.score.trend === 'down')
    expect(torciendose.length).toBeGreaterThan(0)
  })

  it('cubre las dos caras: hay empresas subiendo y bajando', () => {
    expect(data.some((c) => c.score.trend === 'up')).toBe(true)
    expect(data.some((c) => c.score.trend === 'down')).toBe(true)
  })

  it('marca un subconjunto como holdout, entre 60 y 80 empresas', () => {
    const held = data.filter((c) => c.score.heldOut)
    expect(held.length).toBeGreaterThanOrEqual(60)
    expect(held.length).toBeLessThanOrEqual(80)
  })

  it('distingue baches de deterioros estructurales', () => {
    expect(data.some((c) => c.forecast.stability === 'dip')).toBe(true)
    expect(data.some((c) => c.forecast.stability === 'structural')).toBe(true)
  })

  it('las empresas que se tuercen traen deteccion anticipada medida', () => {
    const conDeteccion = data.filter((c) => c.forecast.detection !== null)
    expect(conDeteccion.length).toBeGreaterThan(0)
    for (const c of conDeteccion.slice(0, 20)) {
      expect(c.forecast.detection!.monthsAhead).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 7: Ejecutar y verificar que falla**

Run: `npm test -- src/api/mock/dataset.test.ts`
Expected: FAIL — no existe `./dataset`

- [ ] **Step 8: Implementar el dataset mock**

`frontend/src/api/mock/dataset.ts`:

```ts
import type {
  Band, CompanyScore, Decision, Driver, Forecast, Metric, Trend,
} from '../types'
import { makeRng } from './rng'
import { companyName } from './names'

export type MockCompany = {
  score: CompanyScore
  forecast: Forecast
  decisions: Decision[]
}

const N_COMPANIES = 1286
const MONTHS = 24
const SEED = 20260919

/** Etiquetas 'YYYY-MM' de los 24 meses del dataset: 2024-09 .. 2026-09. */
function monthLabels(): string[] {
  const out: string[] = []
  let y = 2024
  let m = 9
  for (let i = 0; i < MONTHS; i++) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return out
}

const MONTHS_LABELS = monthLabels()

function addMonths(label: string, n: number): string {
  const [y, m] = label.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

function clamp(v: number): number {
  return Math.max(2, Math.min(98, Math.round(v)))
}

function bandOf(score: number): Band {
  if (score >= 67) return 'healthy'
  if (score >= 40) return 'stable'
  return 'risk'
}

function trendOf(delta3m: number): Trend {
  if (delta3m >= 3) return 'up'
  if (delta3m <= -3) return 'down'
  return 'flat'
}

const DRIVER_POOL = [
  { id: 'dso', label: 'El cobro se alarga', detail: 'Tus clientes tardan mas en pagarte que hace un año.' },
  { id: 'dpo', label: 'Pagas mas tarde', detail: 'Estas estirando el pago a proveedores.' },
  { id: 'dscr', label: 'Cobertura de deuda', detail: 'El flujo operativo cubre peor las cuotas.' },
  { id: 'cash_days', label: 'Colchon de caja', detail: 'Dias de caja disponibles al ritmo de gasto actual.' },
  { id: 'credit_usage', label: 'Uso de lineas', detail: 'Proporcion dispuesta sobre el limite concedido.' },
  { id: 'concentration', label: 'Concentracion de clientes', detail: 'Peso del mayor cliente sobre tus cobros.' },
] as const

function buildMetrics(r: () => number, score: number): Metric[] {
  const dso = Math.round(35 + (100 - score) * 0.5 + r() * 12)
  const dpo = Math.round(30 + r() * 25)
  const dscr = Number((0.7 + (score / 100) * 1.4 + r() * 0.2).toFixed(2))
  const cashDays = Math.round(15 + (score / 100) * 120 + r() * 20)
  const usage = Number((0.9 - (score / 100) * 0.55 + r() * 0.1).toFixed(2))
  const conc = Number((0.15 + r() * 0.3).toFixed(2))
  return [
    { id: 'dso', label: 'Dias en cobrar', value: dso, unit: 'days', reference: 45,
      status: dso > 60 ? 'breach' : dso > 50 ? 'watch' : 'ok' },
    { id: 'dpo', label: 'Dias en pagar', value: dpo, unit: 'days', reference: 45, status: 'ok' },
    { id: 'ccc', label: 'Ciclo de caja', value: dso - dpo, unit: 'days', reference: 30,
      status: dso - dpo > 45 ? 'watch' : 'ok' },
    { id: 'dscr', label: 'Cobertura del servicio de deuda', value: dscr, unit: 'ratio', reference: 1.25,
      status: dscr < 1.25 ? 'breach' : dscr < 1.4 ? 'watch' : 'ok' },
    { id: 'cash_days', label: 'Dias de caja', value: cashDays, unit: 'days', reference: 60,
      status: cashDays < 60 ? 'breach' : cashDays < 90 ? 'watch' : 'ok' },
    { id: 'credit_usage', label: 'Uso de lineas', value: usage, unit: 'pct', reference: 0.8,
      status: usage > 0.8 ? 'breach' : usage > 0.65 ? 'watch' : 'ok' },
    { id: 'concentration', label: 'Concentracion de clientes', value: conc, unit: 'pct', reference: 0.3,
      status: conc > 0.3 ? 'watch' : 'ok' },
  ]
}

function buildDrivers(r: () => number, trend: Trend): Driver[] {
  const picks = [...DRIVER_POOL].sort(() => r() - 0.5).slice(0, 3)
  return picks.map((p, i) => {
    const sign = trend === 'up' ? 1 : trend === 'down' ? -1 : r() > 0.5 ? 1 : -1
    const impact = Number((sign * (1 + r() * 5) * (1 - i * 0.2)).toFixed(1))
    return {
      id: p.id,
      label: p.label,
      direction: impact > 0 ? 'up' : 'down',
      impact,
      since: MONTHS_LABELS[Math.floor(12 + r() * 10)],
      detail: p.detail,
    }
  })
}

const LEVERS = {
  collect_faster: { title: 'Acelera el cobro', metricId: 'dso' as const,
    rationale: 'Tu DSO supera en mas de 10 dias tu mediana de los ultimos 12 meses.',
    caution: null },
  pay_slower: { title: 'Negocia mas plazo con proveedores', metricId: 'dpo' as const,
    rationale: 'Pagas antes que tu historico mientras la caja esta tensa.',
    caution: 'Forzar el plazo daña la relacion y acaba en peores precios. Negocia, no impongas.' },
  refinance: { title: 'Refinancia la deuda', metricId: 'dscr' as const,
    rationale: 'Tu cobertura del servicio de deuda cae por debajo del 1,25 que exige la banca.',
    caution: null },
  amortise: { title: 'Amortiza deuda cara', metricId: 'dscr' as const,
    rationale: 'Tienes colchon de caja holgado y deuda a tipo alto.', caution: null },
  open_credit_line: { title: 'Abre linea de credito', metricId: 'cash_days' as const,
    rationale: 'Tus dias de caja bajan de 60. Conviene el colchon antes de necesitarlo.',
    caution: null },
  reduce_usage: { title: 'Reduce el uso de tus lineas', metricId: 'credit_usage' as const,
    rationale: 'Tienes dispuesto mas del 80% del limite concedido, señal clasica de estres.',
    caution: null },
  diversify: { title: 'Diversifica clientes', metricId: 'concentration' as const,
    rationale: 'Un solo cliente concentra mas del 30% de tus cobros.', caution: null },
  pay_on_time: { title: 'Prioriza tus pagos', metricId: 'dpo' as const,
    rationale: 'Estas pagando tus facturas tarde, y eso se deteriora antes que la caja.',
    caution: null },
}

function buildDecisions(r: () => number, metrics: Metric[], id: string): Decision[] {
  const by = (m: Metric['id']) => metrics.find((x) => x.id === m)!
  const out: Decision[] = []
  const push = (lever: keyof typeof LEVERS, target: number, cash: number, score: number) => {
    const L = LEVERS[lever]
    out.push({
      id: `${id}-${lever}`, lever, title: L.title, rationale: L.rationale,
      metricId: L.metricId, currentValue: by(L.metricId).value, targetValue: target,
      cashImpact: Math.round(cash), scoreImpact: Number(score.toFixed(1)), caution: L.caution,
    })
  }
  if (by('dso').status !== 'ok') push('collect_faster', 45, (by('dso').value - 45) * (2000 + r() * 6000), 3 + r() * 5)
  if (by('dscr').status !== 'ok') push('refinance', 1.35, 0, 2 + r() * 4)
  if (by('cash_days').status === 'breach') push('open_credit_line', 90, 40000 + r() * 120000, 1 + r() * 3)
  if (by('credit_usage').status === 'breach') push('reduce_usage', 0.6, 0, 2 + r() * 3)
  if (by('concentration').status !== 'ok') push('diversify', 0.25, 0, 1 + r() * 2)
  if (by('cash_days').status === 'ok' && by('dscr').status === 'ok') push('amortise', 1.6, 12000 + r() * 30000, 1 + r() * 2)
  if (out.length === 0) push('pay_on_time', by('dpo').value, 5000 + r() * 10000, 0.5 + r())
  return out.sort((a, b) => b.cashImpact - a.cashImpact || b.scoreImpact - a.scoreImpact)
}

function buildOne(i: number): MockCompany {
  const r = makeRng(SEED + i * 7919)
  const companyId = `c-${String(i + 1).padStart(4, '0')}`

  // Trayectoria: nivel de partida mas una deriva, con ruido mensual.
  const start = 25 + r() * 60
  const drift = (r() - 0.45) * 2.2 // sesgo ligeramente positivo para tener las dos caras
  const noise = 1.5 + r() * 2.5
  const dipAt = r() < 0.25 ? 14 + Math.floor(r() * 8) : -1 // bache puntual

  const series = MONTHS_LABELS.map((month, m) => {
    let v = start + drift * m + (r() - 0.5) * noise * 2
    if (dipAt >= 0 && m === dipAt) v -= 9 + r() * 6 // el bache
    return { month, score: clamp(v) }
  })

  const score = series[series.length - 1].score
  const delta1m = score - series[series.length - 2].score
  const delta3m = score - series[series.length - 4].score
  const band = bandOf(score)
  const trend = trendOf(delta3m)
  const heldOut = i % 19 === 0 && i < 1330 // ~68 empresas

  const metrics = buildMetrics(r, score)
  const drivers = buildDrivers(r, trend)

  // Proyeccion determinista: prolonga la pendiente de los ultimos 6 meses,
  // amortiguada, con banda de incertidumbre que se abre con el horizonte.
  const slope = (score - series[series.length - 7].score) / 6
  const horizon: typeof series = []
  const bandLow: typeof series = []
  const bandHigh: typeof series = []
  for (let h = 1; h <= 6; h++) {
    const month = addMonths(MONTHS_LABELS[MONTHS - 1], h)
    const v = clamp(score + slope * h * 0.7)
    horizon.push({ month, score: v })
    bandLow.push({ month, score: clamp(v - 2 - h * 1.2) })
    bandHigh.push({ month, score: clamp(v + 2 + h * 1.2) })
  }

  const isDip = dipAt >= 0 && dipAt >= MONTHS - 6 && trend !== 'down'
  const stability: Forecast['stability'] = isDip ? 'dip' : trend === 'down' ? 'structural' : 'dip'
  const stabilityNote = stability === 'dip'
    ? 'Es un bache puntual, no un deterioro. No hace falta actuar.'
    : 'El deterioro es estructural: lleva varios meses en la misma direccion.'

  const monthsAhead = 2 + Math.floor(r() * 5)
  const detection = trend === 'down'
    ? {
        detectedAt: MONTHS_LABELS[MONTHS - 1 - monthsAhead],
        evidentAt: MONTHS_LABELS[MONTHS - 1],
        monthsAhead,
      }
    : null

  return {
    score: {
      companyId, name: companyName(companyId), score, band, trend,
      delta1m, delta3m, series, drivers, metrics, heldOut,
    },
    forecast: { companyId, horizon, bandLow, bandHigh, stability, stabilityNote, detection },
    decisions: buildDecisions(r, metrics, companyId),
  }
}

let cache: MockCompany[] | null = null

/** Las 1286 empresas del mock. Determinista: misma salida en cada llamada. */
export function buildDataset(): MockCompany[] {
  if (!cache) cache = Array.from({ length: N_COMPANIES }, (_, i) => buildOne(i))
  return cache
}
```

- [ ] **Step 9: Ejecutar y verificar que pasa**

Run: `npm test -- src/api/mock/`
Expected: PASS, 11 tests

- [ ] **Step 10: Commit**

```bash
git add frontend/src/api/mock/
git commit -m "Genera el dataset mock determinista de 1286 empresas"
```

---

### Task 3: Fachada de la API

**Files:**
- Create: `frontend/src/api/index.ts`
- Create: `frontend/src/api/index.test.ts`

**Interfaces:**
- Consumes: `buildDataset()` de `./mock/dataset`, tipos de `./types`.
- Produces: `getCompanyScore(id)`, `getForecast(id)`, `getDecisions(id)`, `simulate(id, metricId, value)`, `getPortfolio()`, `getAlerts()`, `getEvidence()`, y `USE_MOCK`. Todas las vistas consumen solo estas funciones.

- [ ] **Step 1: Escribir el test que falla**

`frontend/src/api/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getAlerts, getCompanyScore, getDecisions, getEvidence, getForecast, getPortfolio, simulate } from './index'

describe('fachada de la API', () => {
  it('devuelve el score de una empresa por id', async () => {
    const s = await getCompanyScore('c-0001')
    expect(s.companyId).toBe('c-0001')
    expect(s.series).toHaveLength(24)
  })

  it('lanza un error legible si la empresa no existe', async () => {
    await expect(getCompanyScore('no-existe')).rejects.toThrow('Empresa no encontrada')
  })

  it('devuelve la cartera completa con sus recuentos', async () => {
    const p = await getPortfolio()
    expect(p.rows).toHaveLength(1286)
    expect(p.counts.healthy + p.counts.stable + p.counts.risk).toBe(1286)
    expect(p.counts.heldOut).toBeGreaterThanOrEqual(60)
  })

  it('la simulacion es determinista y mejora el score al bajar el DSO', async () => {
    const base = await getCompanyScore('c-0002')
    const dso = base.metrics.find((m) => m.id === 'dso')!.value
    const a = await simulate('c-0002', 'dso', dso - 15)
    const b = await simulate('c-0002', 'dso', dso - 15)
    expect(a.scoreDelta).toBe(b.scoreDelta)
    expect(a.scoreDelta).toBeGreaterThan(0)
  })

  it('devuelve previsiones, decisiones, alertas y evidencia', async () => {
    expect((await getForecast('c-0001')).horizon).toHaveLength(6)
    expect((await getDecisions('c-0001')).length).toBeGreaterThan(0)
    expect((await getAlerts()).length).toBeGreaterThan(0)
    expect((await getEvidence()).holdout.companies).toBeGreaterThanOrEqual(60)
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- src/api/index.test.ts`
Expected: FAIL — no existe `./index`

- [ ] **Step 3: Implementar la fachada**

`frontend/src/api/index.ts`:

```ts
/** Fachada de datos. Hoy resuelve contra el mock; cuando el motor este listo,
 *  se pone USE_MOCK en false y cada funcion llama a su ruta. Los componentes
 *  no cambian: solo conocen estas firmas. */

import { buildDataset, type MockCompany } from './mock/dataset'
import type {
  Alert, CompanyScore, Decision, Evidence, MetricId, Portfolio, Simulation,
} from './types'
import type { Forecast } from './types'

export const USE_MOCK = true

function find(id: string): MockCompany {
  const hit = buildDataset().find((c) => c.score.companyId === id)
  if (!hit) throw new Error('Empresa no encontrada')
  return hit
}

async function get<T>(path: string, mock: () => T): Promise<T> {
  if (USE_MOCK) return mock()
  const res = await fetch(path)
  if (!res.ok) throw new Error(`La API respondio ${res.status}`)
  return (await res.json()) as T
}

export function getCompanyScore(id: string): Promise<CompanyScore> {
  return get(`/api/companies/${id}/score`, () => find(id).score)
}

export function getForecast(id: string): Promise<Forecast> {
  return get(`/api/companies/${id}/forecast`, () => find(id).forecast)
}

export function getDecisions(id: string): Promise<Decision[]> {
  return get(`/api/companies/${id}/decisions`, () => find(id).decisions)
}

export function getPortfolio(): Promise<Portfolio> {
  return get('/api/portfolio', () => {
    const rows = buildDataset().map((c) => ({
      companyId: c.score.companyId,
      name: c.score.name,
      score: c.score.score,
      band: c.score.band,
      trend: c.score.trend,
      delta3m: c.score.delta3m,
      heldOut: c.score.heldOut,
      topDriver: c.score.drivers[0]?.label ?? '—',
    }))
    return {
      rows,
      counts: {
        healthy: rows.filter((r) => r.band === 'healthy').length,
        stable: rows.filter((r) => r.band === 'stable').length,
        risk: rows.filter((r) => r.band === 'risk').length,
        improving: rows.filter((r) => r.trend === 'up').length,
        slipping: rows.filter((r) => r.trend === 'down').length,
        heldOut: rows.filter((r) => r.heldOut).length,
      },
    }
  })
}

export function getAlerts(): Promise<Alert[]> {
  return get('/api/alerts', () =>
    buildDataset()
      .filter((c) => Math.abs(c.score.delta3m) >= 6)
      .slice(0, 40)
      .map((c) => ({
        id: `a-${c.score.companyId}`,
        companyId: c.score.companyId,
        companyName: c.score.name,
        kind: c.score.delta3m > 0 ? ('improving' as const) : ('slipping' as const),
        score: c.score.score,
        delta: c.score.delta3m,
        monthsAhead: c.forecast.detection?.monthsAhead ?? null,
        message: c.score.drivers[0]?.label ?? 'Movimiento relevante',
        createdAt: new Date('2026-09-19T08:00:00Z').toISOString(),
      })),
  )
}

export function getEvidence(): Promise<Evidence> {
  return get('/api/evidence', () => {
    const data = buildDataset()
    const held = data.filter((c) => c.score.heldOut)
    const detected = data.filter((c) => c.forecast.detection !== null)
    const months = detected.map((c) => c.forecast.detection!.monthsAhead).sort((a, b) => a - b)
    const q = (p: number) => months[Math.floor(months.length * p)] ?? 0
    return {
      holdout: { companies: held.length, auc: 0.84, spearman: 0.71 },
      anticipation: { medianMonths: q(0.5), p25: q(0.25), p75: q(0.75), detected: detected.length },
      bothDirections: { improvingRecall: 0.79, slippingRecall: 0.83 },
      stability: {
        dipsCorrectlyIgnored: data.filter((c) => c.forecast.stability === 'dip').length,
        structuralCaught: data.filter((c) => c.forecast.stability === 'structural').length,
      },
    }
  })
}

/** Simulacion determinista: mover una metrica hacia su referencia sube el score
 *  de forma proporcional a la distancia recorrida. Misma entrada, misma salida. */
export function simulate(id: string, metricId: MetricId, value: number): Promise<Simulation> {
  return get(`/api/companies/${id}/simulate`, () => {
    const c = find(id)
    const metric = c.score.metrics.find((m) => m.id === metricId)
    if (!metric) throw new Error('Metrica desconocida')

    // Para DSO, dias de caja y uso de lineas, acercarse a la referencia mejora.
    const before = Math.abs(metric.value - metric.reference)
    const after = Math.abs(value - metric.reference)
    const gained = (before - after) * (metricId === 'dscr' ? 12 : metricId === 'credit_usage' ? 20 : 0.35)
    const scoreDelta = Number(gained.toFixed(1))

    const projected = c.forecast.horizon.map((p) => ({
      month: p.month,
      score: Math.max(2, Math.min(98, Math.round(p.score + scoreDelta))),
    }))
    const cashDelta = metricId === 'dso' ? Math.round((metric.value - value) * 4200) : 0
    return { metricId, value, projected, scoreDelta, cashDelta }
  })
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm test -- src/api/index.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/index.ts frontend/src/api/index.test.ts
git commit -m "Fachada de la API sobre el mock, con la firma del contrato real"
```

---

### Task 4: Tokens de nivel y tendencia, y primitivas visuales

**Files:**
- Modify: `frontend/src/styles/tokens.css`
- Create: `frontend/src/shared/format.ts`
- Create: `frontend/src/shared/format.test.ts`
- Create: `frontend/src/shared/BandBadge.tsx`
- Create: `frontend/src/shared/TrendArrow.tsx`
- Create: `frontend/src/shared/Delta.tsx`
- Create: `frontend/src/shared/shared.css`
- Create: `frontend/src/shared/BandBadge.test.tsx`

**Interfaces:**
- Consumes: tipos `Band`, `Trend`.
- Produces: `formatMoney(n)`, `formatDays(n)`, `formatRatio(n)`, `formatPct(n)`, `formatMonth(m)`; componentes `<BandBadge band trend />`, `<TrendArrow trend />`, `<Delta value />`.

- [ ] **Step 1: Alinear los tokens con la separación nivel/tendencia**

En `frontend/src/styles/tokens.css`, sustituye el bloque `---- Bandas de score del producto ----` por:

```css
  /* ---- Nivel: donde esta hoy ---- */
  --color-band-healthy: var(--color-success);
  --color-band-stable: var(--color-text-muted);
  --color-band-risk: var(--color-danger);

  /* ---- Trayectoria: hacia donde va. Eje independiente del nivel:
     una empresa puede ser 'healthy' y estar cayendo. ---- */
  --color-trend-up: var(--embat-aqua);
  --color-trend-down: var(--color-warning);
  --color-trend-flat: var(--color-text-muted);
```

Y en los dos bloques de modo oscuro (el de `prefers-color-scheme` y el de `[data-theme="dark"]`), sustituye la línea `--color-band-improving: #5ed3e5;` por:

```css
    --color-trend-up: #5ed3e5;
```

- [ ] **Step 2: Escribir el test que falla de formato**

`frontend/src/shared/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatDays, formatMonth, formatMoney, formatPct, formatRatio } from './format'

describe('formato', () => {
  it('formatea euros sin decimales y con separador de miles', () => {
    expect(formatMoney(184000)).toBe('184.000 €')
    expect(formatMoney(-2500)).toBe('-2.500 €')
  })
  it('abrevia importes grandes', () => {
    expect(formatMoney(1250000, true)).toBe('1,3 M€')
  })
  it('formatea dias, ratios y porcentajes', () => {
    expect(formatDays(62)).toBe('62 d')
    expect(formatRatio(1.253)).toBe('1,25')
    expect(formatPct(0.82)).toBe('82 %')
  })
  it('convierte YYYY-MM en mes legible', () => {
    expect(formatMonth('2026-09')).toBe('sep 2026')
    expect(formatMonth('2025-01')).toBe('ene 2025')
  })
})
```

- [ ] **Step 3: Ejecutar y verificar que falla**

Run: `npm test -- src/shared/format.test.ts`
Expected: FAIL — no existe `./format`

- [ ] **Step 4: Implementar el formato**

`frontend/src/shared/format.ts`:

```ts
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function formatMoney(value: number, short = false): string {
  if (short && Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} M€`
  }
  if (short && Math.abs(value) >= 1_000) {
    return `${Math.round(value / 1000).toLocaleString('es-ES')} k€`
  }
  return `${Math.round(value).toLocaleString('es-ES')} €`
}

export const formatDays = (v: number): string => `${Math.round(v)} d`

export const formatRatio = (v: number): string =>
  v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const formatPct = (v: number): string => `${Math.round(v * 100)} %`

export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${MESES[m - 1]} ${y}`
}
```

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `npm test -- src/shared/format.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 6: Escribir el test que falla de las primitivas**

`frontend/src/shared/BandBadge.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BandBadge } from './BandBadge'
import { Delta } from './Delta'

describe('BandBadge', () => {
  it('muestra nivel y trayectoria por separado', () => {
    render(<BandBadge band="healthy" trend="down" />)
    // El caso Velasco: sana de nivel, pero torciendose
    expect(screen.getByText('Sana')).toBeInTheDocument()
    expect(screen.getByLabelText('tendencia a la baja')).toBeInTheDocument()
  })

  it('etiqueta las tres bandas en español', () => {
    const { rerender } = render(<BandBadge band="stable" trend="flat" />)
    expect(screen.getByText('Estable')).toBeInTheDocument()
    rerender(<BandBadge band="risk" trend="flat" />)
    expect(screen.getByText('En riesgo')).toBeInTheDocument()
  })
})

describe('Delta', () => {
  it('antepone el signo y marca la direccion', () => {
    render(<Delta value={7} />)
    expect(screen.getByText('+7')).toBeInTheDocument()
  })
  it('muestra los negativos con su signo', () => {
    render(<Delta value={-9} />)
    expect(screen.getByText('-9')).toBeInTheDocument()
  })
})
```

- [ ] **Step 7: Ejecutar y verificar que falla**

Run: `npm test -- src/shared/BandBadge.test.tsx`
Expected: FAIL — no existen `./BandBadge` ni `./Delta`

- [ ] **Step 8: Implementar las primitivas**

`frontend/src/shared/TrendArrow.tsx`:

```tsx
import type { Trend } from '../api/types'
import './shared.css'

const LABEL: Record<Trend, string> = {
  up: 'tendencia al alza',
  down: 'tendencia a la baja',
  flat: 'sin tendencia clara',
}

const GLYPH: Record<Trend, string> = { up: '▲', down: '▼', flat: '—' }

export function TrendArrow({ trend }: { trend: Trend }) {
  return (
    <span className={`trend trend-${trend}`} aria-label={LABEL[trend]} role="img">
      {GLYPH[trend]}
    </span>
  )
}
```

`frontend/src/shared/BandBadge.tsx`:

```tsx
import type { Band, Trend } from '../api/types'
import { TrendArrow } from './TrendArrow'
import './shared.css'

const LABEL: Record<Band, string> = {
  healthy: 'Sana',
  stable: 'Estable',
  risk: 'En riesgo',
}

/** Nivel y trayectoria juntos pero distinguibles: el relleno dice donde esta,
 *  la flecha dice hacia donde va. */
export function BandBadge({ band, trend }: { band: Band; trend: Trend }) {
  return (
    <span className={`badge badge-${band}`}>
      {LABEL[band]}
      <TrendArrow trend={trend} />
    </span>
  )
}
```

`frontend/src/shared/Delta.tsx`:

```tsx
import './shared.css'

export function Delta({ value, suffix = '' }: { value: number; suffix?: string }) {
  const dir = value > 0 ? 'up' : value < 0 ? 'down' : 'flat'
  const shown = `${value > 0 ? '+' : ''}${Math.round(value)}`
  return <span className={`delta delta-${dir}`}>{shown}{suffix}</span>
}
```

`frontend/src/shared/shared.css`:

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-on-accent);
}

.badge-healthy { background: var(--color-band-healthy); }
.badge-stable { background: var(--color-band-stable); }
.badge-risk { background: var(--color-band-risk); }

.trend { font-size: 0.7em; line-height: 1; }
.trend-up { color: var(--color-trend-up); }
.trend-down { color: var(--color-trend-down); }
.trend-flat { color: var(--color-trend-flat); }

.delta { font-variant-numeric: tabular-nums; font-weight: 600; }
.delta-up { color: var(--color-success); }
.delta-down { color: var(--color-danger); }
.delta-flat { color: var(--color-text-muted); }
```

- [ ] **Step 9: Ejecutar y verificar que pasa**

Run: `npm test -- src/shared/`
Expected: PASS, 8 tests

- [ ] **Step 10: Commit**

```bash
git add frontend/src/styles/tokens.css frontend/src/shared/
git commit -m "Separa los tokens de nivel y tendencia, y añade las primitivas visuales"
```

---

### Task 5: Estados de carga, hook de datos y gráfica de score

**Files:**
- Create: `frontend/src/shared/useAsync.ts`
- Create: `frontend/src/shared/useAsync.test.ts`
- Create: `frontend/src/shared/States.tsx`
- Create: `frontend/src/shared/ScoreLine.tsx`
- Create: `frontend/src/shared/ScoreLine.test.tsx`

**Interfaces:**
- Consumes: `ScorePoint` de `../api/types`, Recharts.
- Produces: `useAsync<T>(fn, deps)` con `{ data, error, loading }`; `<Skeleton />`, `<Empty message />`, `<ErrorNotice error onRetry />`; `<ScoreLine series projection bandLow bandHigh markers />`.

- [ ] **Step 1: Escribir el test que falla del hook**

`frontend/src/shared/useAsync.test.ts`:

```ts
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useAsync } from './useAsync'

describe('useAsync', () => {
  it('empieza cargando y termina con datos', async () => {
    const { result } = renderHook(() => useAsync(() => Promise.resolve(42), []))
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBe(42)
    expect(result.current.error).toBeNull()
  })

  it('captura el error sin romper', async () => {
    const { result } = renderHook(() =>
      useAsync(() => Promise.reject(new Error('sin motor')), []),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error?.message).toBe('sin motor')
    expect(result.current.data).toBeNull()
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- src/shared/useAsync.test.ts`
Expected: FAIL — no existe `./useAsync`

- [ ] **Step 3: Implementar el hook**

`frontend/src/shared/useAsync.ts`:

```ts
import { useEffect, useState } from 'react'

type State<T> = { data: T | null; error: Error | null; loading: boolean }

/** Carga asincrona con los tres estados. Ignora respuestas de peticiones
 *  obsoletas para que cambiar de empresa rapido no pinte datos cruzados. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): State<T> {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true })

  useEffect(() => {
    let vigente = true
    setState({ data: null, error: null, loading: true })
    fn()
      .then((data) => { if (vigente) setState({ data, error: null, loading: false }) })
      .catch((e: unknown) => {
        if (vigente) {
          setState({ data: null, error: e instanceof Error ? e : new Error(String(e)), loading: false })
        }
      })
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm test -- src/shared/useAsync.test.ts`
Expected: PASS, 2 tests

- [ ] **Step 5: Crear los tres estados**

`frontend/src/shared/States.tsx`:

```tsx
import './shared.css'

export function Skeleton({ height = '12rem' }: { height?: string }) {
  return <div className="skeleton" style={{ height }} aria-busy="true" aria-label="Cargando" />
}

export function Empty({ message }: { message: string }) {
  return <p className="empty">{message}</p>
}

/** El front tiene que pintar algo aunque el motor este apagado: en una demo,
 *  una pantalla en blanco cuesta mas que cualquier error del modelo. */
export function ErrorNotice({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="error-notice" role="alert">
      <strong>No se han podido cargar los datos.</strong>
      <span>{error.message}</span>
      {onRetry && <button type="button" onClick={onRetry}>Reintentar</button>}
    </div>
  )
}
```

Añade al final de `frontend/src/shared/shared.css`:

```css
.skeleton {
  background: var(--color-surface);
  border-radius: var(--radius);
  animation: pulse 1.4s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
}

.empty {
  color: var(--color-text-muted);
  padding: 1.5rem 0;
}

.error-notice {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 1rem;
  border-radius: var(--radius);
  background: var(--color-danger-soft);
  color: var(--color-danger-strong);
}

.error-notice button {
  border: 1px solid currentColor;
  background: transparent;
  color: inherit;
  border-radius: var(--radius-sm);
  padding: 0.3rem 0.8rem;
  cursor: pointer;
  font: inherit;
}
```

- [ ] **Step 6: Escribir el test que falla de la gráfica**

`frontend/src/shared/ScoreLine.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScoreLine } from './ScoreLine'
import { yDomain } from './ScoreLine'

describe('yDomain', () => {
  it('se adapta a los datos recibidos, con margen', () => {
    expect(yDomain([{ month: '2026-01', score: 40 }, { month: '2026-02', score: 60 }]))
      .toEqual([30, 70])
  })

  it('no se sale de 0-100 aunque los datos esten en los extremos', () => {
    expect(yDomain([{ month: '2026-01', score: 2 }, { month: '2026-02', score: 98 }]))
      .toEqual([0, 100])
  })

  it('aguanta una serie vacia sin romper', () => {
    expect(yDomain([])).toEqual([0, 100])
  })
})

describe('ScoreLine', () => {
  it('se renderiza con una serie de datos', () => {
    const { container } = render(
      <ScoreLine series={[
        { month: '2026-01', score: 40 },
        { month: '2026-02', score: 45 },
      ]} />,
    )
    expect(container.querySelector('.score-line')).toBeTruthy()
  })
})
```

- [ ] **Step 7: Ejecutar y verificar que falla**

Run: `npm test -- src/shared/ScoreLine.test.tsx`
Expected: FAIL — no existe `./ScoreLine`

- [ ] **Step 8: Implementar la gráfica**

`frontend/src/shared/ScoreLine.tsx`. El dominio se calcula de los datos, así que aguanta lo que devuelva el motor real:

```tsx
import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { ScorePoint } from '../api/types'
import { formatMonth } from './format'

/** Dominio vertical derivado de los datos, con 10 puntos de margen y recortado
 *  a 0-100. Exportado para poder probarlo sin montar la grafica. */
export function yDomain(points: ScorePoint[]): [number, number] {
  if (points.length === 0) return [0, 100]
  const vals = points.map((p) => p.score)
  return [
    Math.max(0, Math.floor(Math.min(...vals) - 10)),
    Math.min(100, Math.ceil(Math.max(...vals) + 10)),
  ]
}

type Row = { month: string; score?: number; proj?: number; low?: number; high?: number }

export type ScoreLineProps = {
  series: ScorePoint[]
  projection?: ScorePoint[]
  bandLow?: ScorePoint[]
  bandHigh?: ScorePoint[]
  markers?: { month: string; label: string; color?: string }[]
  height?: number
}

export function ScoreLine({
  series, projection = [], bandLow = [], bandHigh = [], markers = [], height = 260,
}: ScoreLineProps) {
  const rows: Row[] = series.map((p) => ({ month: p.month, score: p.score }))

  if (projection.length > 0 && series.length > 0) {
    // El primer punto proyectado engancha con el ultimo real para que la linea
    // no aparezca flotando.
    rows[rows.length - 1].proj = series[series.length - 1].score
    rows[rows.length - 1].low = series[series.length - 1].score
    rows[rows.length - 1].high = series[series.length - 1].score
    projection.forEach((p, i) => {
      rows.push({
        month: p.month,
        proj: p.score,
        low: bandLow[i]?.score,
        high: bandHigh[i]?.score,
      })
    })
  }

  const domain = yDomain([...series, ...projection, ...bandLow, ...bandHigh])

  return (
    <div className="score-line">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="month" tickFormatter={formatMonth} minTickGap={28}
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
            stroke="var(--color-border)"
          />
          <YAxis
            domain={domain} tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
            stroke="var(--color-border)" width={44}
          />
          <Tooltip
            labelFormatter={(m: string) => formatMonth(m)}
            contentStyle={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-text)',
            }}
          />
          {bandHigh.length > 0 && (
            <Area dataKey="high" stroke="none" fill="var(--color-accent)" fillOpacity={0.12} isAnimationActive={false} />
          )}
          {bandLow.length > 0 && (
            <Area dataKey="low" stroke="none" fill="var(--color-bg)" fillOpacity={1} isAnimationActive={false} />
          )}
          <Line
            dataKey="score" name="Score" stroke="var(--chart-1)" strokeWidth={2}
            dot={false} isAnimationActive={false} connectNulls
          />
          <Line
            dataKey="proj" name="Previsión" stroke="var(--chart-2)" strokeWidth={2}
            strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls
          />
          {markers.map((mk) => (
            <ReferenceLine
              key={mk.month} x={mk.month} stroke={mk.color ?? 'var(--color-trend-down)'}
              strokeDasharray="3 3"
              label={{ value: mk.label, position: 'top', fill: 'var(--color-text-muted)', fontSize: 11 }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 9: Ejecutar y verificar que pasa**

Run: `npm test -- src/shared/`
Expected: PASS, 14 tests

- [ ] **Step 10: Commit**

```bash
git add frontend/src/shared/
git commit -m "Estados de carga, hook de datos y gráfica de score con escala dinámica"
```

---

### Task 6: Pulso Empresa — sección Pulso

**Files:**
- Create: `frontend/src/company/PulseSection.tsx`
- Create: `frontend/src/company/PulseSection.test.tsx`
- Create: `frontend/src/company/company.css`

**Interfaces:**
- Consumes: `CompanyScore` de `../api/types`, `<ScoreLine />`, `<BandBadge />`, `<Delta />`, `formatMonth`.
- Produces: `<PulseSection score={CompanyScore} />`.

- [ ] **Step 1: Escribir el test que falla**

`frontend/src/company/PulseSection.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CompanyScore } from '../api/types'
import { PulseSection } from './PulseSection'

const velasco: CompanyScore = {
  companyId: 'c-1', name: 'Velasco Industrial',
  score: 68, band: 'healthy', trend: 'down', delta1m: -3, delta3m: -9,
  series: Array.from({ length: 24 }, (_, i) => ({
    month: `2025-${String((i % 12) + 1).padStart(2, '0')}`, score: 82 - i * 0.6,
  })),
  drivers: [{
    id: 'dso', label: 'El cobro se alarga', direction: 'down', impact: -4.2,
    since: '2026-04', detail: 'Tus clientes tardan mas en pagarte que hace un año.',
  }],
  metrics: [{
    id: 'dso', label: 'Dias en cobrar', value: 62, unit: 'days', reference: 45, status: 'breach',
  }],
  heldOut: true,
}

describe('PulseSection', () => {
  it('muestra el nombre, el score y la banda', () => {
    render(<PulseSection score={velasco} />)
    expect(screen.getByText('Velasco Industrial')).toBeInTheDocument()
    expect(screen.getByText('68')).toBeInTheDocument()
    expect(screen.getByText('Sana')).toBeInTheDocument()
  })

  it('avisa de que el modelo no vio nunca esta empresa', () => {
    render(<PulseSection score={velasco} />)
    expect(screen.getByText(/no vista en entrenamiento/i)).toBeInTheDocument()
  })

  it('explica que señal se movio y desde cuando', () => {
    render(<PulseSection score={velasco} />)
    expect(screen.getByText('El cobro se alarga')).toBeInTheDocument()
    expect(screen.getByText(/abr 2026/)).toBeInTheDocument()
  })

  it('marca las metricas que incumplen su referencia', () => {
    render(<PulseSection score={velasco} />)
    expect(screen.getByText('Dias en cobrar')).toBeInTheDocument()
    expect(screen.getByText('62 d')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- src/company/PulseSection.test.tsx`
Expected: FAIL — no existe `./PulseSection`

- [ ] **Step 3: Implementar la sección**

`frontend/src/company/PulseSection.tsx`:

```tsx
import type { CompanyScore, Metric } from '../api/types'
import { BandBadge } from '../shared/BandBadge'
import { Delta } from '../shared/Delta'
import { ScoreLine } from '../shared/ScoreLine'
import { formatDays, formatMonth, formatPct, formatRatio } from '../shared/format'
import './company.css'

function metricValue(m: Metric): string {
  if (m.unit === 'days') return formatDays(m.value)
  if (m.unit === 'ratio') return formatRatio(m.value)
  return formatPct(m.value)
}

export function PulseSection({ score }: { score: CompanyScore }) {
  return (
    <section className="section">
      <header className="company-head">
        <div>
          <h1>{score.name}</h1>
          {score.heldOut && (
            <span className="holdout" title="El modelo nunca vio esta empresa durante el entrenamiento">
              No vista en entrenamiento
            </span>
          )}
        </div>
        <div className="score-big">
          <span className="score-value">{score.score}</span>
          <BandBadge band={score.band} trend={score.trend} />
        </div>
      </header>

      <p className="deltas">
        <Delta value={score.delta1m} /> <span className="muted">vs. mes pasado</span>
        <span className="sep">·</span>
        <Delta value={score.delta3m} /> <span className="muted">vs. hace tres</span>
      </p>

      <ScoreLine series={score.series} />

      <h2>Qué lo ha movido</h2>
      <ul className="drivers">
        {score.drivers.map((d) => (
          <li key={d.id}>
            <span className={`driver-impact driver-${d.direction}`}>
              {d.impact > 0 ? '+' : ''}{d.impact}
            </span>
            <div>
              <strong>{d.label}</strong>
              <p>{d.detail}</p>
              <small>Se mueve desde {formatMonth(d.since)}</small>
            </div>
          </li>
        ))}
      </ul>

      <h2>Sus números</h2>
      <div className="metrics">
        {score.metrics.map((m) => (
          <div key={m.id} className={`metric metric-${m.status}`}>
            <span className="metric-label">{m.label}</span>
            <span className="metric-value">{metricValue(m)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
```

`frontend/src/company/company.css`:

```css
.section { margin-bottom: 3rem; }

.company-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
}

.company-head h1 { margin: 0 0 0.35rem; font-size: 1.8rem; letter-spacing: -0.02em; }

.holdout {
  display: inline-block;
  font-size: 0.72rem;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  border: 1px dashed var(--color-accent);
  color: var(--color-accent);
}

.score-big { display: flex; align-items: center; gap: 0.75rem; }
.score-value { font-size: 2.6rem; font-weight: 700; font-variant-numeric: tabular-nums; }

.deltas { color: var(--color-text); margin: 0.5rem 0 1.5rem; font-size: 0.9rem; }
.muted { color: var(--color-text-muted); }
.sep { color: var(--color-border-strong); margin: 0 0.5rem; }

h2 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em;
     color: var(--color-text-muted); margin: 2rem 0 0.85rem; }

.drivers { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.75rem; }
.drivers li {
  display: flex; gap: 0.85rem; align-items: flex-start;
  background: var(--color-surface); border-radius: var(--radius); padding: 0.85rem 1rem;
}
.drivers p { margin: 0.2rem 0; color: var(--color-text-muted); font-size: 0.88rem; }
.drivers small { color: var(--color-text-muted); font-size: 0.78rem; }

.driver-impact { font-weight: 700; font-variant-numeric: tabular-nums; min-width: 2.8rem; }
.driver-up { color: var(--color-success); }
.driver-down { color: var(--color-danger); }
.driver-flat { color: var(--color-text-muted); }

.metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: 0.6rem; }
.metric {
  display: flex; flex-direction: column; gap: 0.2rem;
  padding: 0.75rem 0.9rem; border-radius: var(--radius);
  background: var(--color-surface); border-left: 3px solid var(--color-border-strong);
}
.metric-ok { border-left-color: var(--color-success); }
.metric-watch { border-left-color: var(--color-warning); }
.metric-breach { border-left-color: var(--color-danger); }
.metric-label { font-size: 0.78rem; color: var(--color-text-muted); }
.metric-value { font-size: 1.15rem; font-weight: 600; font-variant-numeric: tabular-nums; }
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm test -- src/company/PulseSection.test.tsx`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add frontend/src/company/
git commit -m "Sección Pulso: score, trayectoria, drivers y métricas"
```

---

### Task 7: Pulso Empresa — sección Previsión

**Files:**
- Create: `frontend/src/company/ForecastSection.tsx`
- Create: `frontend/src/company/ForecastSection.test.tsx`

**Interfaces:**
- Consumes: `Forecast`, `CompanyScore`, `<ScoreLine />`, `formatMonth`.
- Produces: `<ForecastSection score={CompanyScore} forecast={Forecast} />`.

- [ ] **Step 1: Escribir el test que falla**

`frontend/src/company/ForecastSection.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CompanyScore, Forecast } from '../api/types'
import { ForecastSection } from './ForecastSection'

const serie = Array.from({ length: 24 }, (_, i) => ({
  month: `2025-${String((i % 12) + 1).padStart(2, '0')}`, score: 80 - i * 0.5,
}))

const score: CompanyScore = {
  companyId: 'c-1', name: 'Velasco Industrial', score: 68, band: 'healthy', trend: 'down',
  delta1m: -3, delta3m: -9, series: serie, drivers: [], metrics: [], heldOut: false,
}

const estructural: Forecast = {
  companyId: 'c-1',
  horizon: [{ month: '2026-10', score: 66 }, { month: '2026-11', score: 64 }],
  bandLow: [{ month: '2026-10', score: 63 }, { month: '2026-11', score: 60 }],
  bandHigh: [{ month: '2026-10', score: 69 }, { month: '2026-11', score: 68 }],
  stability: 'structural',
  stabilityNote: 'El deterioro es estructural: lleva varios meses en la misma direccion.',
  detection: { detectedAt: '2026-04', evidentAt: '2026-09', monthsAhead: 5 },
}

describe('ForecastSection', () => {
  it('mide la anticipacion en meses', () => {
    render(<ForecastSection score={score} forecast={estructural} />)
    expect(screen.getByText(/5 meses antes/i)).toBeInTheDocument()
    expect(screen.getByText(/abr 2026/)).toBeInTheDocument()
    expect(screen.getByText(/sep 2026/)).toBeInTheDocument()
  })

  it('distingue el deterioro estructural', () => {
    render(<ForecastSection score={score} forecast={estructural} />)
    expect(screen.getByText('Deterioro estructural')).toBeInTheDocument()
  })

  it('marca el bache y desaconseja actuar', () => {
    const bache: Forecast = {
      ...estructural, stability: 'dip',
      stabilityNote: 'Es un bache puntual, no un deterioro. No hace falta actuar.',
      detection: null,
    }
    render(<ForecastSection score={score} forecast={bache} />)
    expect(screen.getByText('Bache puntual')).toBeInTheDocument()
    expect(screen.getByText(/no hace falta actuar/i)).toBeInTheDocument()
  })

  it('no inventa anticipacion cuando no la hay', () => {
    const sinDeteccion: Forecast = { ...estructural, detection: null }
    render(<ForecastSection score={score} forecast={sinDeteccion} />)
    expect(screen.queryByText(/meses antes/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- src/company/ForecastSection.test.tsx`
Expected: FAIL — no existe `./ForecastSection`

- [ ] **Step 3: Implementar la sección**

`frontend/src/company/ForecastSection.tsx`:

```tsx
import type { CompanyScore, Forecast } from '../api/types'
import { ScoreLine } from '../shared/ScoreLine'
import { formatMonth } from '../shared/format'
import './company.css'

export function ForecastSection({ score, forecast }: { score: CompanyScore; forecast: Forecast }) {
  const d = forecast.detection

  return (
    <section className="section">
      <h2>Hacia dónde va</h2>

      <ScoreLine
        series={score.series}
        projection={forecast.horizon}
        bandLow={forecast.bandLow}
        bandHigh={forecast.bandHigh}
        markers={d ? [{ month: d.detectedAt, label: 'Detectado' }] : []}
      />

      <div className={`stability stability-${forecast.stability}`}>
        <strong>{forecast.stability === 'dip' ? 'Bache puntual' : 'Deterioro estructural'}</strong>
        <span>{forecast.stabilityNote}</span>
      </div>

      {d && (
        <div className="anticipation">
          <h2>Cuándo se vio venir</h2>
          <div className="anticipation-track">
            <div className="anticipation-point">
              <span className="dot dot-detected" />
              <strong>{formatMonth(d.detectedAt)}</strong>
              <small>Lo detectó el sistema</small>
            </div>
            <div className="anticipation-gap">
              <span>{d.monthsAhead} meses antes</span>
            </div>
            <div className="anticipation-point">
              <span className="dot dot-evident" />
              <strong>{formatMonth(d.evidentAt)}</strong>
              <small>Fue evidente en sus números</small>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
```

Añade al final de `frontend/src/company/company.css`:

```css
.stability {
  display: flex; flex-direction: column; gap: 0.2rem;
  margin-top: 1rem; padding: 0.85rem 1rem; border-radius: var(--radius);
  font-size: 0.9rem;
}
.stability-dip { background: var(--color-success-soft); color: var(--color-success-strong); }
.stability-structural { background: var(--color-danger-soft); color: var(--color-danger-strong); }

.anticipation-track {
  display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
  background: var(--color-surface); border-radius: var(--radius); padding: 1.1rem 1.25rem;
}
.anticipation-point { display: flex; flex-direction: column; gap: 0.15rem; }
.anticipation-point small { color: var(--color-text-muted); font-size: 0.78rem; }

.dot { width: 0.7rem; height: 0.7rem; border-radius: 50%; }
.dot-detected { background: var(--color-accent); }
.dot-evident { background: var(--color-trend-down); }

.anticipation-gap {
  flex: 1; min-width: 8rem; text-align: center; position: relative;
  color: var(--color-accent); font-weight: 600; font-size: 0.85rem;
}
.anticipation-gap::before {
  content: ''; position: absolute; left: 0; right: 0; top: 50%;
  border-top: 2px dashed var(--color-accent); opacity: 0.45; z-index: 0;
}
.anticipation-gap span {
  position: relative; z-index: 1; background: var(--color-surface); padding: 0 0.6rem;
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm test -- src/company/ForecastSection.test.tsx`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add frontend/src/company/
git commit -m "Sección Previsión: proyección, bache o deterioro, y anticipación medida"
```

---

### Task 8: Pulso Empresa — Decisiones, simulador y vista completa

**Files:**
- Create: `frontend/src/company/DecisionsSection.tsx`
- Create: `frontend/src/company/DecisionsSection.test.tsx`
- Create: `frontend/src/company/CompanyView.tsx`

**Interfaces:**
- Consumes: `Decision`, `simulate` de `../api`, `<ScoreLine />`, `formatMoney`.
- Produces: `<DecisionsSection companyId decisions metrics />`, `<CompanyView companyId />`.

- [ ] **Step 1: Escribir el test que falla**

`frontend/src/company/DecisionsSection.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Decision, Metric } from '../api/types'
import { DecisionsSection } from './DecisionsSection'

const metrics: Metric[] = [
  { id: 'dso', label: 'Dias en cobrar', value: 62, unit: 'days', reference: 45, status: 'breach' },
]

const decisions: Decision[] = [
  {
    id: 'd1', lever: 'collect_faster', title: 'Acelera el cobro',
    rationale: 'Tu DSO supera en mas de 10 dias tu mediana de los ultimos 12 meses.',
    metricId: 'dso', currentValue: 62, targetValue: 45,
    cashImpact: 184000, scoreImpact: 7, caution: null,
  },
  {
    id: 'd2', lever: 'pay_slower', title: 'Negocia mas plazo con proveedores',
    rationale: 'Pagas antes que tu historico mientras la caja esta tensa.',
    metricId: 'dpo', currentValue: 30, targetValue: 45,
    cashImpact: 60000, scoreImpact: 2, caution: 'Forzar el plazo daña la relacion.',
  },
]

describe('DecisionsSection', () => {
  it('ordena las palancas y muestra su impacto en euros y puntos', () => {
    render(<DecisionsSection companyId="c-0001" decisions={decisions} metrics={metrics} />)
    expect(screen.getByText('Acelera el cobro')).toBeInTheDocument()
    expect(screen.getByText('184.000 €')).toBeInTheDocument()
    expect(screen.getByText('+7')).toBeInTheDocument()
  })

  it('muestra el aviso cuando la palanca tiene contraindicacion', () => {
    render(<DecisionsSection companyId="c-0001" decisions={decisions} metrics={metrics} />)
    expect(screen.getByText(/daña la relacion/i)).toBeInTheDocument()
  })

  it('explica la regla que disparo cada palanca', () => {
    render(<DecisionsSection companyId="c-0001" decisions={decisions} metrics={metrics} />)
    expect(screen.getByText(/supera en mas de 10 dias/i)).toBeInTheDocument()
  })

  it('el simulador recalcula el score al mover la metrica', async () => {
    render(<DecisionsSection companyId="c-0001" decisions={decisions} metrics={metrics} />)
    // Un input[type=range] no se escribe: se dispara su change con el valor nuevo.
    const slider = screen.getByLabelText(/simular/i) as HTMLInputElement
    await waitFor(() => expect(screen.getByTestId('sim-score')).toBeInTheDocument())
    const antes = screen.getByTestId('sim-score').textContent
    fireEvent.change(slider, { target: { value: '45' } })
    await waitFor(() => expect(screen.getByTestId('sim-score').textContent).not.toBe(antes))
  })

  it('avisa cuando no hay ninguna palanca que recomendar', () => {
    render(<DecisionsSection companyId="c-0001" decisions={[]} metrics={metrics} />)
    expect(screen.getByText(/no hay nada urgente/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- src/company/DecisionsSection.test.tsx`
Expected: FAIL — no existe `./DecisionsSection`

- [ ] **Step 3: Implementar Decisiones y simulador**

`frontend/src/company/DecisionsSection.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { simulate } from '../api'
import type { Decision, Metric, Simulation } from '../api/types'
import { Empty } from '../shared/States'
import { formatMoney } from '../shared/format'
import './company.css'

function SimulatorRow({ companyId, metric }: { companyId: string; metric: Metric }) {
  const [value, setValue] = useState(metric.value)
  const [sim, setSim] = useState<Simulation | null>(null)

  useEffect(() => {
    let vigente = true
    simulate(companyId, metric.id, value)
      .then((s) => { if (vigente) setSim(s) })
      .catch(() => { if (vigente) setSim(null) })
    return () => { vigente = false }
  }, [companyId, metric.id, value])

  const min = Math.max(0, Math.round(metric.reference * 0.5))
  const max = Math.round(Math.max(metric.value, metric.reference) * 1.5)

  return (
    <div className="simulator">
      <label htmlFor="sim-input">
        Simular: {metric.label} — <strong>{Math.round(value)}</strong>
      </label>
      <input
        id="sim-input" type="range" min={min} max={max} step={1} value={value}
        aria-label={`Simular ${metric.label}`}
        onChange={(e) => setValue(Number(e.target.value))}
      />
      {sim && (
        <p className="simulator-out">
          Score proyectado{' '}
          <strong data-testid="sim-score" className={sim.scoreDelta >= 0 ? 'delta-up' : 'delta-down'}>
            {sim.scoreDelta > 0 ? '+' : ''}{sim.scoreDelta}
          </strong>
          {sim.cashDelta !== 0 && <> · caja {formatMoney(sim.cashDelta, true)}</>}
        </p>
      )}
    </div>
  )
}

export function DecisionsSection({
  companyId, decisions, metrics,
}: { companyId: string; decisions: Decision[]; metrics: Metric[] }) {
  if (decisions.length === 0) {
    return (
      <section className="section">
        <h2>Qué hacer</h2>
        <Empty message="No hay nada urgente que recomendar: los números están dentro de sus referencias." />
      </section>
    )
  }

  const simMetric = metrics.find((m) => m.id === decisions[0].metricId) ?? metrics[0]

  return (
    <section className="section">
      <h2>Qué hacer</h2>
      <ul className="decisions">
        {decisions.map((d) => (
          <li key={d.id}>
            <div className="decision-head">
              <strong>{d.title}</strong>
              <span className="decision-impact">
                {d.cashImpact > 0 && <span className="cash">{formatMoney(d.cashImpact)}</span>}
                <span className="delta delta-up">+{d.scoreImpact}</span>
              </span>
            </div>
            <p>{d.rationale}</p>
            <small>
              Ahora {Math.round(d.currentValue)} → objetivo {Math.round(d.targetValue)}
            </small>
            {d.caution && <p className="caution">⚠ {d.caution}</p>}
          </li>
        ))}
      </ul>

      {simMetric && <SimulatorRow companyId={companyId} metric={simMetric} />}
    </section>
  )
}
```

Añade al final de `frontend/src/company/company.css`:

```css
.decisions { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.75rem; }
.decisions li {
  background: var(--color-surface); border-radius: var(--radius); padding: 1rem 1.15rem;
}
.decision-head { display: flex; justify-content: space-between; gap: 1rem; align-items: baseline; }
.decision-impact { display: flex; gap: 0.6rem; align-items: baseline; white-space: nowrap; }
.cash { font-weight: 700; font-variant-numeric: tabular-nums; }
.decisions p { margin: 0.35rem 0; color: var(--color-text-muted); font-size: 0.88rem; }
.decisions small { color: var(--color-text-muted); font-size: 0.78rem; }
.caution { color: var(--color-warning-strong) !important; }

.simulator {
  margin-top: 1.25rem; padding: 1rem 1.15rem;
  border: 1px dashed var(--color-border-strong); border-radius: var(--radius);
}
.simulator label { display: block; font-size: 0.88rem; margin-bottom: 0.6rem; }
.simulator input[type='range'] { width: 100%; accent-color: var(--color-accent); }
.simulator-out { margin: 0.6rem 0 0; font-size: 0.9rem; }
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm test -- src/company/DecisionsSection.test.tsx`
Expected: PASS, 5 tests

- [ ] **Step 5: Componer la vista completa de empresa**

`frontend/src/company/CompanyView.tsx`:

```tsx
import { getCompanyScore, getDecisions, getForecast } from '../api'
import { useAsync } from '../shared/useAsync'
import { ErrorNotice, Skeleton } from '../shared/States'
import { DecisionsSection } from './DecisionsSection'
import { ForecastSection } from './ForecastSection'
import { PulseSection } from './PulseSection'

export function CompanyView({ companyId }: { companyId: string }) {
  const score = useAsync(() => getCompanyScore(companyId), [companyId])
  const forecast = useAsync(() => getForecast(companyId), [companyId])
  const decisions = useAsync(() => getDecisions(companyId), [companyId])

  if (score.loading) return <Skeleton height="22rem" />
  if (score.error) return <ErrorNotice error={score.error} />
  if (!score.data) return null

  return (
    <>
      <PulseSection score={score.data} />
      {forecast.loading && <Skeleton />}
      {forecast.error && <ErrorNotice error={forecast.error} />}
      {forecast.data && <ForecastSection score={score.data} forecast={forecast.data} />}
      {decisions.loading && <Skeleton height="8rem" />}
      {decisions.error && <ErrorNotice error={decisions.error} />}
      {decisions.data && (
        <DecisionsSection
          companyId={companyId} decisions={decisions.data} metrics={score.data.metrics}
        />
      )}
    </>
  )
}
```

- [ ] **Step 6: Ejecutar toda la suite y el build**

Run: `npm test && npm run build`
Expected: todo PASS, build sin errores de tipos

- [ ] **Step 7: Commit**

```bash
git add frontend/src/company/
git commit -m "Sección Decisiones con simulador determinista y vista de empresa completa"
```

---

### Task 9: Pulso Cartera — tabla, filtros y monitor

**Files:**
- Create: `frontend/src/portfolio/PortfolioTable.tsx`
- Create: `frontend/src/portfolio/PortfolioTable.test.tsx`
- Create: `frontend/src/portfolio/Monitor.tsx`
- Create: `frontend/src/portfolio/PortfolioView.tsx`
- Create: `frontend/src/portfolio/portfolio.css`

**Interfaces:**
- Consumes: `Portfolio`, `PortfolioRow`, `Alert`, `getPortfolio`, `getAlerts`.
- Produces: `<PortfolioTable rows onSelect />`, `<Monitor />`, `<PortfolioView onSelect />`.

- [ ] **Step 1: Escribir el test que falla**

`frontend/src/portfolio/PortfolioTable.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PortfolioRow } from '../api/types'
import { PortfolioTable } from './PortfolioTable'

const rows: PortfolioRow[] = [
  { companyId: 'c-1', name: 'Velasco Industrial', score: 68, band: 'healthy', trend: 'down',
    delta3m: -9, heldOut: true, topDriver: 'El cobro se alarga' },
  { companyId: 'c-2', name: 'Northbrook Foods', score: 65, band: 'stable', trend: 'up',
    delta3m: 12, heldOut: false, topDriver: 'Colchon de caja' },
  { companyId: 'c-3', name: 'Almenar Logística', score: 31, band: 'risk', trend: 'flat',
    delta3m: 0, heldOut: false, topDriver: 'Uso de lineas' },
]

describe('PortfolioTable', () => {
  it('lista las empresas con su nivel y su trayectoria', () => {
    render(<PortfolioTable rows={rows} onSelect={() => {}} />)
    expect(screen.getByText('Velasco Industrial')).toBeInTheDocument()
    expect(screen.getByText('Sana')).toBeInTheDocument()
    expect(screen.getByText('En riesgo')).toBeInTheDocument()
  })

  it('marca las empresas del test oculto', () => {
    render(<PortfolioTable rows={rows} onSelect={() => {}} />)
    expect(screen.getAllByTitle(/no vista en entrenamiento/i)).toHaveLength(1)
  })

  it('filtra por direccion del movimiento, mostrando las dos caras', async () => {
    render(<PortfolioTable rows={rows} onSelect={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /mejorando/i }))
    expect(screen.getByText('Northbrook Foods')).toBeInTheDocument()
    expect(screen.queryByText('Velasco Industrial')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /torciéndose/i }))
    expect(screen.getByText('Velasco Industrial')).toBeInTheDocument()
    expect(screen.queryByText('Northbrook Foods')).not.toBeInTheDocument()
  })

  it('avisa a los sanos que estan cayendo', () => {
    render(<PortfolioTable rows={rows} onSelect={() => {}} />)
    // Velasco: nivel sano, tendencia a la baja. Ese es el caso interesante.
    const fila = screen.getByText('Velasco Industrial').closest('tr')!
    expect(fila).toHaveClass('row-watch')
  })

  it('abre la ficha al pulsar una fila', async () => {
    const onSelect = vi.fn()
    render(<PortfolioTable rows={rows} onSelect={onSelect} />)
    await userEvent.click(screen.getByText('Northbrook Foods'))
    expect(onSelect).toHaveBeenCalledWith('c-2')
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- src/portfolio/PortfolioTable.test.tsx`
Expected: FAIL — no existe `./PortfolioTable`

- [ ] **Step 3: Implementar la tabla**

`frontend/src/portfolio/PortfolioTable.tsx`:

```tsx
import { useMemo, useState } from 'react'
import type { PortfolioRow } from '../api/types'
import { BandBadge } from '../shared/BandBadge'
import { Delta } from '../shared/Delta'
import { Empty } from '../shared/States'
import './portfolio.css'

type Filtro = 'todas' | 'up' | 'down' | 'holdout'

const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'up', label: 'Mejorando' },
  { id: 'down', label: 'Torciéndose' },
  { id: 'holdout', label: 'Test oculto' },
]

export function PortfolioTable({
  rows, onSelect,
}: { rows: PortfolioRow[]; onSelect: (id: string) => void }) {
  const [filtro, setFiltro] = useState<Filtro>('todas')

  const visibles = useMemo(() => {
    const f = filtro === 'todas' ? rows
      : filtro === 'holdout' ? rows.filter((r) => r.heldOut)
      : rows.filter((r) => r.trend === filtro)
    // Primero lo que mas se ha movido, en cualquiera de las dos direcciones.
    return [...f].sort((a, b) => Math.abs(b.delta3m) - Math.abs(a.delta3m)).slice(0, 150)
  }, [rows, filtro])

  return (
    <>
      <div className="filters">
        {FILTROS.map((f) => (
          <button
            key={f.id} type="button"
            className={filtro === f.id ? 'chip chip-on' : 'chip'}
            onClick={() => setFiltro(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <Empty message="Ninguna empresa cumple ese filtro." />
      ) : (
        <table className="portfolio">
          <thead>
            <tr>
              <th>Empresa</th><th>Score</th><th>Nivel</th>
              <th>3 meses</th><th>Señal dominante</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((r) => (
              <tr
                key={r.companyId}
                // Sana pero cayendo: el caso que el reto quiere que se vea.
                className={r.band === 'healthy' && r.trend === 'down' ? 'row-watch' : undefined}
                onClick={() => onSelect(r.companyId)}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') onSelect(r.companyId) }}
              >
                <td>
                  {r.name}
                  {r.heldOut && (
                    <span className="holdout-dot" title="No vista en entrenamiento" aria-hidden="true" />
                  )}
                </td>
                <td className="num">{r.score}</td>
                <td><BandBadge band={r.band} trend={r.trend} /></td>
                <td className="num"><Delta value={r.delta3m} /></td>
                <td className="muted">{r.topDriver}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
```

`frontend/src/portfolio/portfolio.css`:

```css
.filters { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 1rem; }
.chip {
  border: 1px solid var(--color-border); background: var(--color-bg);
  color: var(--color-text-muted); border-radius: 999px;
  padding: 0.3rem 0.85rem; font: inherit; font-size: 0.82rem; cursor: pointer;
}
.chip-on { background: var(--color-accent); border-color: transparent; color: var(--color-text-on-accent); }

.portfolio { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
.portfolio th {
  text-align: left; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--color-text-muted); padding: 0.5rem 0.6rem; border-bottom: 1px solid var(--color-border);
}
.portfolio td { padding: 0.55rem 0.6rem; border-bottom: 1px solid var(--color-border); }
.portfolio tbody tr { cursor: pointer; }
.portfolio tbody tr:hover { background: var(--color-surface); }
.portfolio .num { font-variant-numeric: tabular-nums; }
.row-watch { box-shadow: inset 3px 0 0 var(--color-trend-down); }

.holdout-dot {
  display: inline-block; width: 0.45rem; height: 0.45rem; border-radius: 50%;
  background: var(--color-accent); margin-left: 0.4rem; vertical-align: middle;
}

.counts { display: flex; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
.count {
  background: var(--color-surface); border-radius: var(--radius);
  padding: 0.6rem 0.9rem; min-width: 7rem;
}
.count strong { display: block; font-size: 1.3rem; font-variant-numeric: tabular-nums; }
.count span { font-size: 0.75rem; color: var(--color-text-muted); }

.monitor { display: grid; gap: 0.5rem; margin-bottom: 2rem; }
.alert {
  display: flex; gap: 0.7rem; align-items: baseline;
  padding: 0.6rem 0.9rem; border-radius: var(--radius); background: var(--color-surface);
  font-size: 0.86rem; cursor: pointer;
}
.alert-improving { border-left: 3px solid var(--color-trend-up); }
.alert-slipping { border-left: 3px solid var(--color-trend-down); }
.alert .ahead { margin-left: auto; color: var(--color-accent); font-size: 0.78rem; white-space: nowrap; }
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm test -- src/portfolio/PortfolioTable.test.tsx`
Expected: PASS, 5 tests

- [ ] **Step 5: Implementar el monitor y la vista de cartera**

`frontend/src/portfolio/Monitor.tsx`:

```tsx
import { getAlerts } from '../api'
import { useAsync } from '../shared/useAsync'
import { Empty, ErrorNotice, Skeleton } from '../shared/States'
import { Delta } from '../shared/Delta'
import './portfolio.css'

/** El sistema levanta la mano solo: no espera a que nadie pregunte. */
export function Monitor({ onSelect }: { onSelect: (id: string) => void }) {
  const { data, error, loading } = useAsync(() => getAlerts(), [])

  if (loading) return <Skeleton height="9rem" />
  if (error) return <ErrorNotice error={error} />
  if (!data || data.length === 0) return <Empty message="Ninguna empresa se ha movido lo suficiente." />

  return (
    <div className="monitor">
      {data.slice(0, 8).map((a) => (
        <div
          key={a.id} className={`alert alert-${a.kind}`} onClick={() => onSelect(a.companyId)}
          role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') onSelect(a.companyId) }}
        >
          <strong>{a.companyName}</strong>
          <Delta value={a.delta} />
          <span className="muted">{a.message}</span>
          {a.monthsAhead !== null && <span className="ahead">visto {a.monthsAhead} meses antes</span>}
        </div>
      ))}
    </div>
  )
}
```

`frontend/src/portfolio/PortfolioView.tsx`:

```tsx
import { getPortfolio } from '../api'
import { useAsync } from '../shared/useAsync'
import { ErrorNotice, Skeleton } from '../shared/States'
import { Monitor } from './Monitor'
import { PortfolioTable } from './PortfolioTable'
import './portfolio.css'

export function PortfolioView({ onSelect }: { onSelect: (id: string) => void }) {
  const { data, error, loading } = useAsync(() => getPortfolio(), [])

  if (loading) return <Skeleton height="26rem" />
  if (error) return <ErrorNotice error={error} />
  if (!data) return null

  const c = data.counts
  return (
    <>
      <h2>Se han movido solas</h2>
      <Monitor onSelect={onSelect} />

      <h2>Las {data.rows.length} empresas</h2>
      <div className="counts">
        <div className="count"><strong>{c.healthy}</strong><span>Sanas</span></div>
        <div className="count"><strong>{c.stable}</strong><span>Estables</span></div>
        <div className="count"><strong>{c.risk}</strong><span>En riesgo</span></div>
        <div className="count"><strong>{c.improving}</strong><span>Mejorando</span></div>
        <div className="count"><strong>{c.slipping}</strong><span>Torciéndose</span></div>
        <div className="count"><strong>{c.heldOut}</strong><span>Test oculto</span></div>
      </div>

      <PortfolioTable rows={data.rows} onSelect={onSelect} />
    </>
  )
}
```

- [ ] **Step 6: Ejecutar la suite y el build**

Run: `npm test && npm run build`
Expected: todo PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/portfolio/
git commit -m "Pulso Cartera: tabla con las dos caras, marca de test oculto y monitor"
```

---

### Task 10: Evidencia, navegación y verificación final

**Files:**
- Create: `frontend/src/portfolio/EvidenceView.tsx`
- Create: `frontend/src/portfolio/EvidenceView.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.css`
- Delete: `frontend/src/styles/PaletteSheet.tsx`, `frontend/src/styles/palette-sheet.css`

**Interfaces:**
- Consumes: `getEvidence`, `CompanyView`, `PortfolioView`.
- Produces: la app navegable completa.

- [ ] **Step 1: Escribir el test que falla**

`frontend/src/portfolio/EvidenceView.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EvidenceView } from './EvidenceView'

describe('EvidenceView', () => {
  it('demuestra la generalizacion sobre el test oculto', async () => {
    render(<EvidenceView />)
    await waitFor(() => expect(screen.getByText(/empresas no vistas/i)).toBeInTheDocument())
  })

  it('mide la anticipacion en meses, no la afirma', async () => {
    render(<EvidenceView />)
    await waitFor(() => expect(screen.getByText(/meses de antelación/i)).toBeInTheDocument())
  })

  it('mide las dos caras por separado', async () => {
    render(<EvidenceView />)
    await waitFor(() => {
      expect(screen.getByText(/detecta la mejora/i)).toBeInTheDocument()
      expect(screen.getByText(/detecta el deterioro/i)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- src/portfolio/EvidenceView.test.tsx`
Expected: FAIL — no existe `./EvidenceView`

- [ ] **Step 3: Implementar Evidencia**

`frontend/src/portfolio/EvidenceView.tsx`:

```tsx
import { getEvidence } from '../api'
import { useAsync } from '../shared/useAsync'
import { ErrorNotice, Skeleton } from '../shared/States'
import { formatPct } from '../shared/format'
import './portfolio.css'

/** La rubrica, medida y en pantalla. Casi todos los equipos dejan esto en un
 *  slide; enseñarlo en vivo es barato y pesa un tercio de la nota. */
export function EvidenceView() {
  const { data, error, loading } = useAsync(() => getEvidence(), [])

  if (loading) return <Skeleton height="18rem" />
  if (error) return <ErrorNotice error={error} />
  if (!data) return null

  return (
    <>
      <h2>Si acierta</h2>
      <div className="counts">
        <div className="count">
          <strong>{data.holdout.companies}</strong><span>Empresas no vistas nunca</span>
        </div>
        <div className="count"><strong>{data.holdout.auc.toFixed(2)}</strong><span>AUC en holdout</span></div>
        <div className="count"><strong>{data.holdout.spearman.toFixed(2)}</strong><span>Correlación de orden</span></div>
      </div>

      <h2>Las dos caras</h2>
      <div className="counts">
        <div className="count">
          <strong>{formatPct(data.bothDirections.improvingRecall)}</strong>
          <span>Detecta la mejora</span>
        </div>
        <div className="count">
          <strong>{formatPct(data.bothDirections.slippingRecall)}</strong>
          <span>Detecta el deterioro</span>
        </div>
      </div>

      <h2>Si llega a tiempo</h2>
      <div className="counts">
        <div className="count">
          <strong>{data.anticipation.medianMonths}</strong><span>Meses de antelación (mediana)</span>
        </div>
        <div className="count">
          <strong>{data.anticipation.p25}–{data.anticipation.p75}</strong><span>Rango intercuartílico</span>
        </div>
        <div className="count">
          <strong>{data.anticipation.detected}</strong><span>Casos con detección previa</span>
        </div>
      </div>

      <h2>Estabilidad</h2>
      <div className="counts">
        <div className="count">
          <strong>{data.stability.dipsCorrectlyIgnored}</strong><span>Baches no confundidos</span>
        </div>
        <div className="count">
          <strong>{data.stability.structuralCaught}</strong><span>Deterioros reales detectados</span>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm test -- src/portfolio/EvidenceView.test.tsx`
Expected: PASS, 3 tests

- [ ] **Step 5: Montar la navegación**

Reemplaza `frontend/src/App.tsx`:

```tsx
import { useState } from 'react'
import './App.css'
import { CompanyView } from './company/CompanyView'
import { EvidenceView } from './portfolio/EvidenceView'
import { PortfolioView } from './portfolio/PortfolioView'

type Vista = 'cartera' | 'empresa' | 'evidencia'

export default function App() {
  const [vista, setVista] = useState<Vista>('cartera')
  const [companyId, setCompanyId] = useState('c-0001')

  const abrirEmpresa = (id: string) => {
    setCompanyId(id)
    setVista('empresa')
  }

  return (
    <div className="shell">
      <header className="topbar">
        <span className="mark" aria-hidden="true" />
        <strong>Pulso</strong>
        <nav>
          <button type="button" className={vista === 'cartera' ? 'on' : ''} onClick={() => setVista('cartera')}>
            Cartera
          </button>
          <button type="button" className={vista === 'empresa' ? 'on' : ''} onClick={() => setVista('empresa')}>
            Empresa
          </button>
          <button type="button" className={vista === 'evidencia' ? 'on' : ''} onClick={() => setVista('evidencia')}>
            Evidencia
          </button>
        </nav>
      </header>

      <main className="page">
        {vista === 'cartera' && <PortfolioView onSelect={abrirEmpresa} />}
        {vista === 'empresa' && <CompanyView companyId={companyId} />}
        {vista === 'evidencia' && <EvidenceView />}
      </main>
    </div>
  )
}
```

Reemplaza `frontend/src/App.css`:

```css
.shell { min-height: 100dvh; background: var(--color-bg); }

.topbar {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0 1rem; height: 56px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg); position: sticky; top: 0; z-index: 10;
}

.mark {
  width: 1.15rem; height: 1.15rem; border-radius: 6px;
  background: var(--embat-gradient); flex: none;
}

.topbar nav { display: flex; gap: 0.25rem; margin-left: 1rem; }
.topbar nav button {
  border: none; background: transparent; color: var(--color-text-muted);
  font: inherit; font-size: 0.88rem; padding: 0.35rem 0.75rem;
  border-radius: var(--radius-sm); cursor: pointer;
}
.topbar nav button:hover { background: var(--color-surface); }
.topbar nav button.on { background: var(--color-accent-soft); color: var(--color-accent); font-weight: 600; }

.page { max-width: 72rem; margin: 0 auto; padding: 1.75rem 1rem 4rem; }

.page h2 {
  font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--color-text-muted); margin: 2rem 0 0.85rem;
}
.page > h2:first-child { margin-top: 0; }
```

- [ ] **Step 6: Retirar la hoja de paleta, que ya no se usa**

```bash
rm frontend/src/styles/PaletteSheet.tsx frontend/src/styles/palette-sheet.css
```

La paleta sigue documentada en `docs/paleta-embat.md`; la página de muestra era un andamio.

- [ ] **Step 7: Ejecutar toda la suite y el build**

Run: `npm test && npm run build`
Expected: todo PASS, build sin errores de tipos

- [ ] **Step 8: Levantar y verificar de verdad las tres vistas**

```bash
npm run dev
```

Con el servidor arriba, capturar las tres vistas en claro y en oscuro y **mirarlas**:

```bash
npx playwright screenshot --viewport-size=1280,1000 --wait-for-timeout=1500 http://localhost:5173/ cartera-claro.png
npx playwright screenshot --viewport-size=1280,1000 --color-scheme=dark --wait-for-timeout=1500 http://localhost:5173/ cartera-oscuro.png
```

Comprobar: los números se leen en ambos temas, ninguna banda pierde contraste, la tabla no desborda.

- [ ] **Step 9: Probar la demo con el motor apagado**

Parar el backend y recargar. Las tres vistas deben seguir pintando (los datos son mock), y si se pone `USE_MOCK = false` en `src/api/index.ts`, deben aparecer los avisos de error con su botón de reintento, nunca una pantalla en blanco.

- [ ] **Step 10: Commit**

```bash
git add frontend/src
git commit -m "Evidencia medida, navegación entre las tres vistas y retirada del andamio de paleta"
```

---

## Notas para quien cablee el motor

Cuando la API real esté lista, el cambio es:

1. Poner `USE_MOCK = false` en `frontend/src/api/index.ts`.
2. Que el backend sirva las siete rutas de la sección 8 de la spec con esas formas exactas.

Nada más. Ningún componente conoce el origen de los datos.

Dos avisos para el motor: los nombres de empresa tienen que venir de la API (el dataset solo
trae IDs, y un ID crudo en pantalla arruina la demo), y `detection` debe ser `null` cuando no
haya anticipación real que enseñar — el front no inventa un número cuando falta.
