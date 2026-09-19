import { bandFromScore } from '../constants'
import type { Company, CompanyDetail, CompanyMonthKpi, Group, RiskScore, SizeBand } from '../types'
import { COUNTRY_WEIGHTS, SECTORS, makeCompanyName, makeGroupName, type Country } from './names'
import { clamp, gauss, mulberry32, round, weightedPick, type Rng } from './random'

export const MODEL_VERSION = 'lgbm-v2.3.1'
export const N_COMPANIES = 1286
export const N_GROUPS = 250
export const N_MONTHS = 24
const MAX_GROUP_SIZE = 24

export interface CompanyRecord {
  company: Company
  detail: CompanyDetail
  /** Clave de búsqueda sin tildes ni mayúsculas. */
  nameKey: string
  history: RiskScore[]
  kpis: CompanyMonthKpi[]
}

export interface Dataset {
  records: CompanyRecord[]
  byId: Map<string, CompanyRecord>
  groups: Group[]
  groupById: Map<string, Group>
  months: string[]
  asOf: string
}

export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Los 24 meses que terminan en el mes actual, del más antiguo al más reciente. */
function buildMonths(today: Date): { key: string; lastDay: Date }[] {
  const months: { key: string; lastDay: Date }[] = []
  for (let back = N_MONTHS - 1; back >= 0; back--) {
    const first = new Date(today.getFullYear(), today.getMonth() - back, 1)
    const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0)
    months.push({ key: `${first.getFullYear()}-${pad(first.getMonth() + 1)}`, lastDay })
  }
  return months
}

function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

function shuffle<T>(rng: Rng, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const a = items[i] as T
    items[i] = items[j] as T
    items[j] = a
  }
  return items
}

/** Tamaños de grupo con cola larga: muchos grupos de 1 a 4 filiales, unos pocos de hasta 24. */
function buildGroupSizes(rng: Rng): number[] {
  const sizes = Array.from({ length: N_GROUPS }, () => 1 + Math.floor((MAX_GROUP_SIZE - 5) * rng() ** 3.5))
  let total = sizes.reduce((sum, size) => sum + size, 0)
  while (total > N_COMPANIES) {
    const i = Math.floor(rng() * N_GROUPS)
    if ((sizes[i] as number) > 1) {
      sizes[i] = (sizes[i] as number) - 1
      total--
    }
  }
  while (total < N_COMPANIES) {
    const i = Math.floor(rng() * N_GROUPS)
    if ((sizes[i] as number) < MAX_GROUP_SIZE) {
      sizes[i] = (sizes[i] as number) + 1
      total++
    }
  }
  return sizes
}

interface StressEvent {
  start: number
  amplitude: number
}

/**
 * Serie latente de "estrés" (0 a 1) con 25 puntos: el primero solo sirve para calcular
 * el delta del primer mes visible. Score y KPIs se derivan de ella, así que son coherentes.
 */
function buildStress(rng: Rng, groupShift: number, groupEvent: StressEvent | null): number[] {
  const length = N_MONTHS + 1
  const r = rng()
  const rawBase = r < 0.62 ? 0.08 + 0.22 * rng() : r < 0.87 ? 0.3 + 0.22 * rng() : 0.55 + 0.3 * rng()
  const base = clamp(rawBase + groupShift, 0.04, 0.85)

  let event: StressEvent | null = null
  const e = rng()
  if (e < 0.1) {
    event = { start: length - randInt(rng, 2, 7), amplitude: 0.15 + 0.2 * rng() }
  } else if (e < 0.13) {
    event = { start: length - randInt(rng, 4, 8), amplitude: -(0.12 + 0.15 * rng()) }
  } else if (groupEvent && rng() < 0.6) {
    event = { start: groupEvent.start, amplitude: groupEvent.amplitude * (0.7 + 0.3 * rng()) }
  }

  const series: number[] = []
  let previous = clamp(base + gauss(rng) * 0.04, 0.02, 0.97)
  for (let t = 0; t < length; t++) {
    let target = base
    if (event && t >= event.start) {
      const progress = (t - event.start + 1) / (length - event.start)
      target = Math.min(0.92, target + event.amplitude * progress ** 1.8)
    }
    previous = clamp(previous + 0.7 * (target - previous) + gauss(rng) * 0.02, 0.02, 0.97)
    series.push(previous)
  }
  return series
}

const SIZE_SCALE: Record<SizeBand, number> = { micro: 35_000, pequeña: 220_000, mediana: 1_400_000, grande: 7_000_000 }

function buildKpis(rng: Rng, companyId: string, size: SizeBand, stress: number[], monthKeys: string[]): CompanyMonthKpi[] {
  const scale = SIZE_SCALE[size] * Math.exp(gauss(rng) * 0.35)
  return monthKeys.map((month, i) => {
    const s = stress[i + 1] as number
    return {
      companyId,
      month,
      dpdMean: round(clamp(2.5 + 20 * s ** 1.15 + gauss(rng) * 0.9, 0.5, 45), 1),
      liquidityBalance: Math.round((scale * (1.5 - 1.25 * s) * (1 + gauss(rng) * 0.04)) / 100) * 100,
      collectionsToPaymentsRatio: round(clamp(1.25 - 0.55 * s + gauss(rng) * 0.04, 0.5, 1.5), 2),
      overdueInvoiceRatio: round(clamp(0.03 + 0.34 * s ** 1.2 + gauss(rng) * 0.012, 0, 0.6), 3),
    }
  })
}

function percentileOf(sortedAscending: number[], value: number): number {
  let low = 0
  let high = sortedAscending.length
  while (low < high) {
    const mid = (low + high) >> 1
    if ((sortedAscending[mid] as number) < value) low = mid + 1
    else high = mid
  }
  return Math.min(99, round((low / sortedAscending.length) * 100, 0))
}

function buildDataset(): Dataset {
  const rng = mulberry32(1286)
  const today = new Date()
  const months = buildMonths(today)
  const monthKeys = months.map((m) => m.key)
  const asOf = isoDate(today)

  const groupSizes = buildGroupSizes(rng)
  const takenGroupNames = new Set<string>()
  const groupIds: string[] = []
  const groups: Group[] = groupSizes.map((size, i) => {
    const id = `grp-${String(i + 1).padStart(3, '0')}`
    for (let k = 0; k < size; k++) groupIds.push(id)
    return { id, name: makeGroupName(rng, takenGroupNames), size }
  })
  const groupById = new Map(groups.map((g) => [g.id, g]))
  shuffle(rng, groupIds)

  const groupCountry = new Map<string, Country>()
  const groupShift = new Map<string, number>()
  const groupEvent = new Map<string, StressEvent | null>()
  for (const g of groups) {
    groupCountry.set(g.id, weightedPick(rng, COUNTRY_WEIGHTS))
    groupShift.set(g.id, gauss(rng) * 0.07)
    groupEvent.set(g.id, rng() < 0.1 ? { start: N_MONTHS + 1 - randInt(rng, 3, 6), amplitude: 0.15 + 0.15 * rng() } : null)
  }

  const takenNames = new Set<string>()
  const sectorWeights = SECTORS.map((sector, i) => [sector, 1.6 - i * 0.09] as const)
  const sizeWeights: readonly (readonly [SizeBand, number])[] = [
    ['micro', 0.25],
    ['pequeña', 0.4],
    ['mediana', 0.27],
    ['grande', 0.08],
  ]

  const stressById = new Map<string, number[]>()
  const records: CompanyRecord[] = groupIds.map((groupId, i) => {
    const id = `emp-${String(i + 1).padStart(4, '0')}`
    const sector = weightedPick(rng, sectorWeights)
    const country = rng() < 0.9 ? (groupCountry.get(groupId) as Country) : weightedPick(rng, COUNTRY_WEIGHTS)
    const size = weightedPick(rng, sizeWeights)
    const name = makeCompanyName(rng, sector, country, takenNames)
    const group = groupById.get(groupId) as Group

    const company: Company = { id, name, sector, country, groupId }
    const detail: CompanyDetail = { ...company, groupName: group.name, groupSize: group.size, size }

    const stress = buildStress(rng, groupShift.get(groupId) as number, groupEvent.get(groupId) ?? null)
    stressById.set(id, stress)
    const kpis = buildKpis(rng, id, size, stress, monthKeys)
    return { company, detail, nameKey: normalizeText(name), history: [], kpis }
  })

  // Scores enteros por mes y percentiles de cada mes sobre toda la cartera.
  const scoresByMonth: number[][] = Array.from({ length: N_MONTHS + 1 }, (_, t) =>
    records.map((rec) => Math.round(clamp((stressById.get(rec.company.id) as number[])[t] as number, 0.01, 0.99) * 100)),
  )
  const sortedByMonth = scoresByMonth.map((scores) => [...scores].sort((a, b) => a - b))

  records.forEach((rec, idx) => {
    const lag = weightedPick(rng, [[0, 0.7], [1, 0.2], [2, 0.1]] as const)
    rec.history = months.map((m, i) => {
      const score = (scoresByMonth[i + 1] as number[])[idx] as number
      const previous = (scoresByMonth[i] as number[])[idx] as number
      const isLatest = i === N_MONTHS - 1
      const latestDay = Math.max(1, today.getDate() - lag)
      const date = isLatest ? isoDate(new Date(today.getFullYear(), today.getMonth(), latestDay)) : isoDate(m.lastDay)
      return {
        companyId: rec.company.id,
        date,
        score,
        percentile: percentileOf(sortedByMonth[i + 1] as number[], score),
        band: bandFromScore(score),
        deltaVsPrevMonth: score - previous,
        modelVersion: MODEL_VERSION,
      }
    })
  })

  return { records, byId: new Map(records.map((r) => [r.company.id, r])), groups, groupById, months: monthKeys, asOf }
}

let cached: Dataset | null = null

export function getDataset(): Dataset {
  if (!cached) cached = buildDataset()
  return cached
}

export function latestScore(rec: CompanyRecord): RiskScore {
  return rec.history[rec.history.length - 1] as RiskScore
}

