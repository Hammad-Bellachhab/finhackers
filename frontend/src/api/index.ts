/** Fachada de datos. Lee los JSON que precalcula el motor (python -m src.pulso ->
 *  public/data/), salvo en los tests o con VITE_MOCK=1, que resuelven contra el mock.
 *  Los componentes no cambian: solo conocen estas firmas. */

import { buildDataset, type MockCompany } from './mock/dataset'
import { companyName } from './mock/names'
import type {
  Alert, CompanyScore, Decision, Evidence, Forecast, MetricId, Portfolio, Simulation,
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
  if (!res.ok) throw new Error(res.status === 404 ? 'Empresa no encontrada' : `Los datos respondieron ${res.status}`)
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
