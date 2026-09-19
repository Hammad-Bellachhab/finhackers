/*
 * Contrato de datos del frontend. Las cinco primeras interfaces son las del
 * prompt; el resto son extensiones aditivas que necesitan las vistas.
 * Cuando exista el backend real, solo cambia la implementación de ScoringApi.
 */

export interface Company {
  id: string
  name: string
  sector: string
  country: string
  groupId: string
}

export type RiskBand = 'bajo' | 'medio' | 'alto'

export interface RiskScore {
  companyId: string
  date: string
  score: number
  percentile: number
  band: RiskBand
  deltaVsPrevMonth: number
  modelVersion: string
}

export interface ScoreExplanation {
  companyId: string
  date: string
  /** `contribution` es la magnitud en puntos de score; el sentido va en `direction`. */
  topFactors: { feature: string; contribution: number; direction: 'increases' | 'decreases' }[]
  naturalLanguageSummary: string
}

export interface CompanyMonthKpi {
  companyId: string
  month: string
  dpdMean: number
  liquidityBalance: number
  collectionsToPaymentsRatio: number
  overdueInvoiceRatio: number
}

export interface Benchmark {
  cohortKey: string
  cohortSize: number
  p25: number
  p50: number
  p75: number
  metric: string
}

/* Extensiones */

export type SizeBand = 'micro' | 'pequeña' | 'mediana' | 'grande'

export interface CompanyDetail extends Company {
  groupName: string
  groupSize: number
  size: SizeBand
}

export interface Group {
  id: string
  name: string
  size: number
}

export interface PortfolioRow {
  company: Company
  score: RiskScore
}

export type PortfolioSortKey = 'score' | 'delta' | 'percentile' | 'name' | 'sector' | 'date'

export interface ListCompaniesParams {
  query?: string
  riskBand?: RiskBand
  sector?: string
  groupId?: string
  risingFast?: boolean
  sortBy?: PortfolioSortKey
  sortDir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export interface PortfolioSummary {
  asOf: string
  totalCompanies: number
  byBand: Record<RiskBand, number>
  risingFast: number
  meanDelta: number
}

export interface FilterOptions {
  sectors: string[]
  groups: Group[]
}

export type BenchmarkMetric = 'score' | 'dpd' | 'overdue' | 'collections'

export type BenchmarkResult = {
  metric: BenchmarkMetric
  metricLabel: string
  unit: string
  cohortLevel: 'tamano-pais' | 'grupo'
  cohortLabel: string
  cohortKey: string
  cohortSize: number
  companyValue: number
} & (({ available: true } & Pick<Benchmark, 'p25' | 'p50' | 'p75'>) | { available: false })

export type SimulationScenarioKind = 'retraso_cliente_principal' | 'caida_liquidez' | 'mas_facturas_vencidas'

export interface SimulationRequest {
  companyId: string
  scenario: SimulationScenarioKind
  /** Días de retraso, % de caída de liquidez o puntos porcentuales de facturas vencidas. */
  amount: number
}

export interface SimulationResult {
  companyId: string
  scenario: SimulationScenarioKind
  amount: number
  currentScore: number
  projectedScore: number
  delta: number
  currentBand: RiskBand
  projectedBand: RiskBand
  summary: string
}

export interface ModelMetric {
  key: string
  label: string
  higherIsBetter: boolean
  modelA: { value: number; ciLow: number; ciHigh: number }
  modelB: { value: number; ciLow: number; ciHigh: number }
}

export interface PrCurvePoint {
  recall: number
  precisionA: number
  precisionB: number
}

export interface AblationBlock {
  block: string
  description: string
  /** Puntos de AUC-PR que se pierden al quitar el bloque. */
  aucPrDrop: number
}

export interface GlobalShapFeature {
  feature: string
  meanAbsContribution: number
  direction: 'increases' | 'decreases'
}

export interface ModelInfo {
  modelVersion: string
  aucPr: number
  aucPrCiLow: number
  aucPrCiHigh: number
  universeSize: number
  positiveRate: number
  trainedAt: string
  scoredAt: string
  observationMonths: number
  outcomeMonths: number
  comparison: ModelMetric[]
  prCurve: PrCurvePoint[]
  ablation: AblationBlock[]
  globalShap: GlobalShapFeature[]
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** Una función por endpoint. La implementación mock se sustituye por la real sin tocar componentes. */
export interface ScoringApi {
  /** GET /companies?query&riskBand&sector&page */
  listCompanies(params?: ListCompaniesParams): Promise<Page<PortfolioRow>>
  /** GET /companies/{id} */
  getCompany(id: string): Promise<CompanyDetail>
  /** GET /companies/{id}/score */
  getScore(id: string): Promise<RiskScore>
  /** GET /companies/{id}/score?history=true */
  getScoreHistory(id: string): Promise<RiskScore[]>
  /** GET /companies/{id}/explanation */
  getExplanation(id: string): Promise<ScoreExplanation>
  /** GET /companies/{id}/kpis */
  getKpis(id: string): Promise<CompanyMonthKpi[]>
  /** GET /benchmarks?companyId */
  getBenchmarks(companyId: string): Promise<BenchmarkResult[]>
  /** POST /simulate */
  simulate(request: SimulationRequest): Promise<SimulationResult>
  /** GET /model/info */
  getModelInfo(): Promise<ModelInfo>
  /** GET /portfolio/summary */
  getPortfolioSummary(): Promise<PortfolioSummary>
  /** GET /companies/filters */
  getFilterOptions(): Promise<FilterOptions>
}
