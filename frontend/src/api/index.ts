/** Fachada de datos. Lee los JSON que precalcula el motor (python -m src.pulso ->
 *  public/data/), salvo en los tests o con VITE_MOCK=1, que resuelven contra el mock.
 *  Los componentes no cambian: solo conocen estas firmas. */

import { buildDataset, type MockCompany } from './mock/dataset'
import { companyName } from './mock/names'
import type {
  Alert, CompanyProfile, CompanyScore, Decision, Evidence, Forecast, MetricId, ModelReport,
  Portfolio, Providers, Simulation, TellMe,
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
    // TellMe escribe IDs (COMP_1065): en pantalla van los mismos nombres que en el resto de la web.
    .then((t) => t && JSON.parse(JSON.stringify(t).replace(/COMP_\d{4}/g, (id) => companyName(id))))
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
