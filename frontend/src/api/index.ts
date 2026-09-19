/** Fachada de datos. Llama al motor (pipeline/src/api/pulso.py) salvo en los tests
 *  o con VITE_MOCK=1, que resuelven contra el mock. Los componentes no cambian:
 *  solo conocen estas firmas. */

import { buildDataset, type MockCompany } from './mock/dataset'
import { companyName } from './mock/names'
import type {
  Alert, CompanyScore, Decision, Evidence, Forecast, MetricId, Portfolio, Simulation,
} from './types'

const USE_MOCK = import.meta.env.MODE === 'test' || import.meta.env.VITE_MOCK === '1'

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

async function get<T>(path: string, mock: () => T, init?: RequestInit): Promise<T> {
  if (USE_MOCK) return mock()
  const res = await fetch(path, init)
  if (!res.ok) throw new Error(`La API respondió ${res.status}`)
  return JSON.parse(await res.text(), withNames) as T
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
    if (!metric) throw new Error('Métrica desconocida')

    // Acercarse a la referencia mejora; alejarse penaliza.
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
  }, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metricId, value }),
  })
}
