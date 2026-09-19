import { DEFAULT_PAGE_SIZE, MIN_COHORT_SIZE, RISING_FAST_DELTA, bandFromScore } from './constants'
import { buildExplanation } from './mock/explain'
import { buildModelInfo } from './mock/model'
import { getDataset, latestScore, normalizeText, type CompanyRecord } from './mock/dataset'
import { round } from './mock/random'
import {
  ApiError,
  type BenchmarkMetric,
  type BenchmarkResult,
  type ListCompaniesParams,
  type PortfolioRow,
  type PortfolioSortKey,
  type RiskBand,
  type ScoringApi,
  type SimulationRequest,
  type SimulationResult,
  type SimulationScenarioKind,
} from './types'

// El dataset se construye al cargar el módulo para que no cuente dentro de la latencia simulada.
getDataset()

const MIN_LATENCY_MS = 300
const MAX_LATENCY_MS = 600

/** Simula la red: entre 300 y 600 ms por llamada. */
function withLatency<T>(produce: () => T): Promise<T> {
  const wait = MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS)
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(produce())
      } catch (error) {
        reject(error)
      }
    }, wait)
  })
}

function requireRecord(id: string): CompanyRecord {
  const rec = getDataset().byId.get(id)
  if (!rec) throw new ApiError(404, `No existe ninguna empresa con el identificador ${id}.`)
  return rec
}

function compareRows(sortBy: PortfolioSortKey): (a: CompanyRecord, b: CompanyRecord) => number {
  switch (sortBy) {
    case 'delta':
      return (a, b) => latestScore(a).deltaVsPrevMonth - latestScore(b).deltaVsPrevMonth
    case 'percentile':
      return (a, b) => latestScore(a).percentile - latestScore(b).percentile
    case 'name':
      return (a, b) => a.company.name.localeCompare(b.company.name, 'es')
    case 'sector':
      return (a, b) => a.company.sector.localeCompare(b.company.sector, 'es') || a.company.name.localeCompare(b.company.name, 'es')
    case 'date':
      return (a, b) => latestScore(a).date.localeCompare(latestScore(b).date)
    default:
      return (a, b) => latestScore(a).score - latestScore(b).score
  }
}

const COUNTRY_NAMES: Record<string, string> = { ES: 'España', PT: 'Portugal', FR: 'Francia', IT: 'Italia' }
const SIZE_LABELS = { micro: 'Microempresas', pequeña: 'Empresas pequeñas', mediana: 'Empresas medianas', grande: 'Grandes empresas' } as const

const METRICS: { metric: BenchmarkMetric; label: string; unit: string; read: (rec: CompanyRecord) => number }[] = [
  { metric: 'score', label: 'Score de riesgo', unit: 'puntos', read: (rec) => latestScore(rec).score },
  { metric: 'dpd', label: 'Retraso medio de pago', unit: 'días', read: (rec) => (rec.kpis[rec.kpis.length - 1]?.dpdMean ?? 0) },
  {
    metric: 'overdue',
    label: 'Facturas vencidas',
    unit: '%',
    read: (rec) => round((rec.kpis[rec.kpis.length - 1]?.overdueInvoiceRatio ?? 0) * 100, 1),
  },
  {
    metric: 'collections',
    label: 'Cobros sobre pagos',
    unit: 'ratio',
    read: (rec) => rec.kpis[rec.kpis.length - 1]?.collectionsToPaymentsRatio ?? 0,
  },
]

function quantile(sortedAscending: number[], q: number): number {
  const position = (sortedAscending.length - 1) * q
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  const a = sortedAscending[lower] as number
  const b = sortedAscending[upper] as number
  return a + (b - a) * (position - lower)
}

const SCENARIO_MODEL: Record<SimulationScenarioKind, { maxImpact: number; halfLife: number; describe: (amount: number) => string }> = {
  retraso_cliente_principal: {
    maxImpact: 40,
    halfLife: 25,
    describe: (amount) => `el cliente principal paga ${amount} días más tarde`,
  },
  caida_liquidez: {
    maxImpact: 34,
    halfLife: 45,
    describe: (amount) => `la liquidez cae un ${amount} %`,
  },
  mas_facturas_vencidas: {
    maxImpact: 45,
    halfLife: 15,
    describe: (amount) => `las facturas vencidas suben ${amount} puntos porcentuales`,
  },
}

function runSimulation(request: SimulationRequest): SimulationResult {
  const rec = requireRecord(request.companyId)
  const model = SCENARIO_MODEL[request.scenario]
  if (!model) throw new ApiError(400, 'El escenario no está soportado. Elige uno de los que ofrece el simulador.')
  const amount = Math.max(0, request.amount)
  const current = latestScore(rec).score
  const impact = model.maxImpact * (1 - Math.exp(-amount / model.halfLife))
  // Cuanto más alto ya es el score, menos margen queda para empeorar.
  const projected = Math.min(99, Math.round(current + impact * (1.15 - 0.6 * (current / 100))))
  const currentBand = bandFromScore(current)
  const projectedBand = bandFromScore(projected)
  const bandNote = projectedBand !== currentBand ? ` y la empresa entraría en riesgo ${projectedBand}` : ''
  return {
    companyId: request.companyId,
    scenario: request.scenario,
    amount,
    currentScore: current,
    projectedScore: projected,
    delta: projected - current,
    currentBand,
    projectedBand,
    summary: `Si ${model.describe(amount)}, el score pasaría de ${current} a ${projected}${bandNote}.`,
  }
}

export const mockApi: ScoringApi = {
  listCompanies(params: ListCompaniesParams = {}) {
    return withLatency(() => {
      const { records } = getDataset()
      const query = params.query ? normalizeText(params.query) : ''
      const filtered = records.filter((rec) => {
        const score = latestScore(rec)
        if (query && !rec.nameKey.includes(query)) return false
        if (params.riskBand && score.band !== params.riskBand) return false
        if (params.sector && rec.company.sector !== params.sector) return false
        if (params.groupId && rec.company.groupId !== params.groupId) return false
        if (params.risingFast && score.deltaVsPrevMonth < RISING_FAST_DELTA) return false
        return true
      })

      const direction = (params.sortDir ?? (params.sortBy === 'name' || params.sortBy === 'sector' ? 'asc' : 'desc')) === 'asc' ? 1 : -1
      const primary = compareRows(params.sortBy ?? 'score')
      filtered.sort(
        (a, b) =>
          direction * primary(a, b) ||
          latestScore(b).deltaVsPrevMonth - latestScore(a).deltaVsPrevMonth ||
          a.company.name.localeCompare(b.company.name, 'es'),
      )

      const pageSize = Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE)
      const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
      const page = Math.min(Math.max(1, params.page ?? 1), pageCount)
      const items: PortfolioRow[] = filtered
        .slice((page - 1) * pageSize, page * pageSize)
        .map((rec) => ({ company: rec.company, score: latestScore(rec) }))
      return { items, total: filtered.length, page, pageSize, pageCount }
    })
  },

  getCompany(id) {
    return withLatency(() => requireRecord(id).detail)
  },

  getScore(id) {
    return withLatency(() => latestScore(requireRecord(id)))
  },

  getScoreHistory(id) {
    return withLatency(() => requireRecord(id).history)
  },

  getExplanation(id) {
    return withLatency(() => buildExplanation(requireRecord(id)))
  },

  getKpis(id) {
    return withLatency(() => requireRecord(id).kpis)
  },

  getBenchmarks(companyId) {
    return withLatency(() => {
      const rec = requireRecord(companyId)
      const { records, groupById } = getDataset()
      const group = groupById.get(rec.company.groupId)
      const sizeCohort = records.filter((r) => r.detail.size === rec.detail.size && r.company.country === rec.company.country)
      const groupCohort = records.filter((r) => r.company.groupId === rec.company.groupId)
      const cohorts = [
        {
          level: 'tamano-pais' as const,
          label: `${SIZE_LABELS[rec.detail.size]} de ${COUNTRY_NAMES[rec.company.country] ?? rec.company.country}`,
          key: `${rec.detail.size}:${rec.company.country}`,
          members: sizeCohort,
        },
        { level: 'grupo' as const, label: group?.name ?? rec.company.groupId, key: rec.company.groupId, members: groupCohort },
      ]

      const results: BenchmarkResult[] = []
      for (const cohort of cohorts) {
        for (const m of METRICS) {
          const base = {
            metric: m.metric,
            metricLabel: m.label,
            unit: m.unit,
            cohortLevel: cohort.level,
            cohortLabel: cohort.label,
            cohortKey: cohort.key,
            cohortSize: cohort.members.length,
            companyValue: m.read(rec),
          }
          if (cohort.members.length < MIN_COHORT_SIZE) {
            results.push({ ...base, available: false })
            continue
          }
          const values = cohort.members.map(m.read).sort((a, b) => a - b)
          results.push({
            ...base,
            available: true,
            p25: round(quantile(values, 0.25), 2),
            p50: round(quantile(values, 0.5), 2),
            p75: round(quantile(values, 0.75), 2),
          })
        }
      }
      return results
    })
  },

  simulate(request) {
    return withLatency(() => runSimulation(request))
  },

  getModelInfo() {
    return withLatency(() => buildModelInfo(getDataset().asOf))
  },

  getPortfolioSummary() {
    return withLatency(() => {
      const { records, asOf } = getDataset()
      const byBand: Record<RiskBand, number> = { bajo: 0, medio: 0, alto: 0 }
      let risingFast = 0
      let deltaSum = 0
      for (const rec of records) {
        const score = latestScore(rec)
        byBand[score.band]++
        if (score.deltaVsPrevMonth >= RISING_FAST_DELTA) risingFast++
        deltaSum += score.deltaVsPrevMonth
      }
      return { asOf, totalCompanies: records.length, byBand, risingFast, meanDelta: round(deltaSum / records.length, 1) }
    })
  },

  getFilterOptions() {
    return withLatency(() => {
      const { records, groups } = getDataset()
      const sectors = [...new Set(records.map((r) => r.company.sector))].sort((a, b) => a.localeCompare(b, 'es'))
      const multi = groups.filter((g) => g.size >= 2).sort((a, b) => a.name.localeCompare(b.name, 'es'))
      return { sectors, groups: multi }
    })
  },
}
