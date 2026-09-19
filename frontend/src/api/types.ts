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
