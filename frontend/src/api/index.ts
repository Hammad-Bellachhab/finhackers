/** Fachada de datos. Lee los JSON que precalcula el motor (python -m src.pulso ->
 *  public/data/), salvo en los tests o con VITE_MOCK=1, que resuelven contra el mock.
 *  Los componentes no cambian: solo conocen estas firmas. */

import { buildDataset, type MockCompany } from './mock/dataset'
import { companyName } from './mock/names'
import type {
  Alert, AskResponse, AskScope, ChatTurn, CompanyProfile, CompanyScore, Decision, Drag, Evidence, Forecast,
  MetricId, ModelReport, Plan, PlanLever, Portfolio, Providers, Simulation, TellMe,
} from './types'

const USE_MOCK = import.meta.env.MODE === 'test' || import.meta.env.VITE_MOCK === '1'

/** Empresa que abre la pestaña Empresa si no se ha elegido ninguna desde la cartera. */
export const DEFAULT_COMPANY = USE_MOCK ? 'c-0001' : 'COMP_0001'

function find(id: string): MockCompany {
  const hit = buildDataset().find((c) => c.score.companyId === id)
  if (!hit) throw new Error('Empresa no encontrada')
  return hit
}

/** El dataset solo trae IDs: cada objeto con companyId recibe su nombre legible. */
function withNames(_key: string, v: unknown): unknown {
  if (v && typeof v === 'object' && 'companyId' in v) {
    const o = v as Record<string, unknown>
    const name = companyName(String(o.companyId))
    if ('name' in o) o.name = name
    if ('companyName' in o) o.companyName = name
  }
  return v
}

async function get<T>(path: string, mock: () => T): Promise<T> {
  if (USE_MOCK) return mock()
  const res = await fetch(path)
  // Un fichero que no existe vuelve como index.html (fallback de SPA en Vite y Cloudflare): es un 404.
  const missing = res.status === 404 || (res.ok && !res.headers.get('content-type')?.includes('json'))
  if (missing) throw new Error('Empresa no encontrada', { cause: 404 })
  if (!res.ok) throw new Error(`Los datos respondieron ${res.status}`)
  return JSON.parse(await res.text(), withNames) as T
}

export function getCompanyScore(id: string): Promise<CompanyScore> {
  return get(`/data/companies/${id}/score.json`, () => find(id).score)
}

export function getForecast(id: string): Promise<Forecast> {
  return get(`/data/companies/${id}/forecast.json`, () => find(id).forecast)
}

export function getDecisions(id: string): Promise<Decision[]> {
  return get(`/data/companies/${id}/decisions.json`, () => find(id).decisions)
}

const SIN_MOCK = (): never => { throw new Error('Solo disponible con los datos del motor') }

export function getProfile(id: string): Promise<CompanyProfile> {
  return get(`/data/companies/${id}/profile.json`, SIN_MOCK)
}

export function getModelReport(): Promise<ModelReport> {
  return get('/data/model.json', SIN_MOCK)
}

/** TellMe escribe IDs (COMP_1065): en pantalla van los mismos nombres que en el resto de la web. */
const withCompanyNames = <T,>(x: T): T =>
  JSON.parse(JSON.stringify(x).replace(/COMP_\d{4}/g, (id) => companyName(id)))

/** Pregunta a TellMe sobre una empresa (o sobre la cartera si no hay id). La IA vive en el Worker. */
export async function askTellMe(question: string, scope: AskScope = {}, history: ChatTurn[] = []): Promise<AskResponse> {
  if (USE_MOCK) {
    return {
      answer: 'Respuesta de ejemplo (mock). En modo real responde TellMe con los datos del motor.',
      bullets: [], followUps: ['¿Qué hago primero?'], model: 'mock',
    }
  }
  const res = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, ...scope, companyId: scope.companyId ?? null, history }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data || data.error) throw new Error(data?.error?.message ?? 'TellMe no está disponible ahora mismo.')
  return withCompanyNames(data as AskResponse)
}

/** Análisis de TellMe (la IA de Embat). Sin id: el de la cartera. null = aún no generado (404). */
export function getTellMe(companyId?: string): Promise<TellMe | null> {
  const path = companyId ? `/data/companies/${companyId}/tellme.json` : '/data/tellme/portfolio.json'
  return get<TellMe | null>(path, () => ({
    scope: companyId ? 'company' : 'portfolio',
    companyId,
    headline: companyId ? 'Sana, pero cobra cada vez más tarde' : '885 empresas sanas; 169 empiezan a torcerse',
    summary: 'Resumen de ejemplo (mock). En modo real lo escribe TellMe a partir de los datos del motor.',
    insights: [
      {
        id: 'mock-1', kind: 'trend', severity: 'watch', title: 'El cobro se alarga',
        explanation: 'Sus clientes tardan 19 días más en pagar que hace un año.',
        evidence: [{ label: 'Días en cobrar', value: '72 d' }, { label: 'Mediana 12 m', value: '53 d' }],
        action: 'Revisar los plazos con los tres clientes principales.',
      },
    ],
    glossary: [{ term: 'DSO', plain: 'Días que tardas en cobrar una factura.' }],
    generatedAt: '2026-09-19T00:00:00Z',
    model: 'mock',
  }))
    .then((t) => t && withCompanyNames(t))
    .catch((e: Error) => {
      if (e.cause === 404) return null
      throw e
    })
}

export function getPortfolio(): Promise<Portfolio> {
  return get('/data/portfolio.json', () => {
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

/** Proveedores financieros (bancos y conectores) con las empresas de cada uno.
 *  Sale del cruce de los productos contratados con la salud que sirve el motor. */
export function getProviders(): Promise<Providers> {
  return get('/data/providers.json', SIN_MOCK)
}

export function getAlerts(): Promise<Alert[]> {
  return get('/data/alerts.json', () =>
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
  return get('/data/evidence.json', () => {
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

type SimPoint = { value: number; scoreDelta: number; cashDelta: number }

/** Interpolacion lineal sobre la rejilla precalculada por el motor (se satura en los extremos). */
function interpolate(grid: SimPoint[], value: number): SimPoint {
  const i = grid.findIndex((p) => p.value >= value)
  if (i === -1) return grid[grid.length - 1]
  if (i === 0) return grid[0]
  const [a, b] = [grid[i - 1], grid[i]]
  const t = (value - a.value) / (b.value - a.value || 1)
  return {
    value,
    scoreDelta: Number((a.scoreDelta + t * (b.scoreDelta - a.scoreDelta)).toFixed(1)),
    cashDelta: Math.round(a.cashDelta + t * (b.cashDelta - a.cashDelta)),
  }
}

/** Simulacion determinista: misma entrada, misma salida. El efecto sale del modelo real,
 *  precalculado en una rejilla por metrica. */
export async function simulate(id: string, metricId: MetricId, value: number): Promise<Simulation> {
  if (!USE_MOCK) {
    const [grids, forecast] = await Promise.all([
      get<Partial<Record<MetricId, SimPoint[]>>>(`/data/companies/${id}/simulate.json`, () => ({})),
      getForecast(id),
    ])
    const grid = grids[metricId]
    if (!grid) throw new Error('Esta empresa no tiene datos para esa métrica')
    const { scoreDelta, cashDelta } = interpolate(grid, value)
    const projected = forecast.horizon.map((p) => ({
      month: p.month, score: Math.max(0, Math.min(100, Number((p.score + scoreDelta).toFixed(1)))),
    }))
    return { metricId, value, projected, scoreDelta, cashDelta }
  }

  // Mock: acercarse a la referencia mejora; alejarse penaliza.
  const c = find(id)
  const metric = c.score.metrics.find((m) => m.id === metricId)
  if (!metric) throw new Error('Métrica desconocida')
  const before = Math.abs(metric.value - metric.reference)
  const after = Math.abs(value - metric.reference)
  const factor = metricId === 'dscr' ? 12 : metricId === 'credit_usage' ? 20 : 0.35
  const scoreDelta = Number(((before - after) * factor).toFixed(1))
  const projected = c.forecast.horizon.map((p) => ({
    month: p.month,
    score: Math.max(2, Math.min(98, Math.round(p.score + scoreDelta))),
  }))
  const cashDelta = metricId === 'dso' ? Math.round((metric.value - value) * 4200) : 0
  return { metricId, value, projected, scoreDelta, cashDelta }
}

// --------------------------------------------------------------------------------------
// Plan de mejora: qué le baja el score y hasta dónde lo suben las palancas que sigan activas.
// --------------------------------------------------------------------------------------

/** El motor de scoring, si está levantado. Sin él la app sigue funcionando (ver getPlan). */
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

/** Qué palanca corrige cada feature. Espejo de FEATURE_METRIC en pipeline/src/metrics.py; solo
 *  se usa en el camino degradado, porque cuando el motor responde ya lo manda resuelto. */
const METRIC_OF: Record<string, MetricId> = {
  cash_conversion_days_w6: 'dso', rec_dpd_mean_w3: 'dso', rec_dpd_mean_w6: 'dso',
  pay_dpd_mean_w3: 'dpo', pay_dpd_mean_w6: 'dpo', pay_term_days_w6: 'dpo',
  debt_service_ratio_w6: 'dscr',
  days_of_cash: 'cash_days', cash_months_of_outflow: 'cash_days',
  credit_util_T: 'credit_usage', credit_util_max_w6: 'credit_usage',
  top1_in_share: 'concentration',
}

/** Plan con el score exacto: el motor aplica todas las palancas a la vez y repuntúa una vez.
 *  Si no contesta (no levantado, caído, demo sin servidor) se cae al plan aproximado y lo marca. */
export async function getPlan(id: string, targets: Partial<Record<MetricId, number>>): Promise<Plan> {
  if (!USE_MOCK) {
    try {
      const res = await fetch(`${API}/companies/${id}/plan`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targets }),
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) return { ...(await res.json()), companyId: id, exact: true } as Plan
    } catch {
      // El motor no está: no es un error de la app, se sigue con la rejilla precalculada.
    }
  }
  return approximatePlan(id, targets)
}

/** Camino degradado: suma los efectos por separado de la rejilla que ya precalcula el motor.
 *  Ignora el solape entre palancas, así que se marca exact:false y la UI lo advierte. */
async function approximatePlan(id: string, targets: Partial<Record<MetricId, number>>): Promise<Plan> {
  const score = await getCompanyScore(id)
  const entries = Object.entries(targets) as [MetricId, number][]
  const sims = await Promise.all(
    entries.map(([m, v]) => simulate(id, m, v).then((s) => s).catch(() => null)),
  )

  const levers: PlanLever[] = entries.flatMap(([m, to], i) => {
    const sim = sims[i]
    const metric = score.metrics.find((x) => x.id === m)
    if (!sim || !metric) return []
    return [{ metricId: m, label: metric.label, unit: metric.unit, from: metric.value, to, scoreDelta: sim.scoreDelta }]
  })

  const scoreDelta = Number(levers.reduce((a, l) => a + l.scoreDelta, 0).toFixed(1))
  const drags: Drag[] = score.drivers
    .filter((d) => d.impact < 0)
    .map((d) => ({ id: d.id, label: d.label, impact: d.impact, block: '', metricId: METRIC_OF[d.id] ?? null }))

  return {
    companyId: id,
    baseHealth: score.score,
    planHealth: Math.max(0, Math.min(100, Number((score.score + scoreDelta).toFixed(1)))),
    scoreDelta,
    levers,
    drags,
    exact: false,
  }
}
