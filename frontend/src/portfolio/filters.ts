import type { PortfolioSortKey, RiskBand } from '../api'

export interface PortfolioFilters {
  query: string
  riskBand: RiskBand | ''
  sector: string
  groupId: string
  risingFast: boolean
  sortBy: PortfolioSortKey
  sortDir: 'asc' | 'desc'
  page: number
}

/** Por defecto: toda la cartera, de más a menos riesgo. */
export const DEFAULT_FILTERS: PortfolioFilters = {
  query: '',
  riskBand: '',
  sector: '',
  groupId: '',
  risingFast: false,
  sortBy: 'score',
  sortDir: 'desc',
  page: 1,
}

const SORT_KEYS: readonly string[] = ['score', 'delta', 'percentile', 'name', 'sector', 'date']

export function isPortfolioFilters(value: unknown): value is PortfolioFilters {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.query === 'string' &&
    (v.riskBand === '' || v.riskBand === 'bajo' || v.riskBand === 'medio' || v.riskBand === 'alto') &&
    typeof v.sector === 'string' &&
    typeof v.groupId === 'string' &&
    typeof v.risingFast === 'boolean' &&
    typeof v.sortBy === 'string' &&
    SORT_KEYS.includes(v.sortBy) &&
    (v.sortDir === 'asc' || v.sortDir === 'desc') &&
    typeof v.page === 'number'
  )
}

export function hasActiveFilters(filters: PortfolioFilters): boolean {
  return Boolean(filters.query || filters.riskBand || filters.sector || filters.groupId || filters.risingFast)
}
