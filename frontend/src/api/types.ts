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
  // Detalle del motor (vista Cartera de Diego). Opcionales: el mock no los trae.
  healthBand?: HealthBand
  trajectory?: string
  signal?: string
  delta1m?: number
  pDeterioration?: number
  group?: string
  sizeCohort?: string
  country?: string
  erp?: string
  bank?: string
}

/** Las cuatro bandas finas del motor (Band las agrupa en tres). */
export type HealthBand = 'sólida' | 'sana' | 'vigilar' | 'riesgo'

export type PortfolioMonth = {
  month: string; solid: number; healthy: number; watch: number; risk: number; meanHealth: number
}

export type Portfolio = {
  rows: PortfolioRow[]
  counts: {
    healthy: number; stable: number; risk: number
    improving: number; slipping: number; heldOut: number
  }
  month?: string
  history?: PortfolioMonth[]
}

/** Cuántos productos de un tipo (checking, loan, lineofcredit…) hay contratados. */
export type ProductCount = { type: string; n: number }

/** Una empresa vista desde su proveedor financiero: lo que tiene con él y cómo respira. */
export type ProviderCompany = {
  companyId: string
  name: string
  score: number
  band: Band
  healthBand: HealthBand
  trend: Trend
  delta3m: number
  products: number
  types: ProductCount[]
  granted: number      // concedido en financiación, en positivo
  outstanding: number  // saldo vivo, en positivo
}

/** Banco o conector por el que entran los datos de un grupo de empresas.
 *  Es la cartera vista del lado del prestamista: quién le respira bien y quién no. */
export type Provider = {
  name: string
  services: string[]
  companies: number
  products: number
  types: ProductCount[]
  bands: Record<HealthBand, number>
  meanHealth: number
  riskShare: number
  slipping: number
  improving: number
  granted: number
  outstanding: number
  rows: ProviderCompany[]
}

export type Providers = {
  providers: Provider[]
  month: string
  totals: { providers: number; companies: number; connectors: number; products: number }
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
  signal?: string // los 5 tipos del monitor del motor
  severity?: number
  delta1m?: number
  why?: string
}

export type Evidence = {
  holdout: { companies: number; auc: number; spearman: number }
  anticipation: { medianMonths: number; p25: number; p75: number; detected: number }
  bothDirections: { improvingRecall: number; slippingRecall: number }
  stability: { dipsCorrectlyIgnored: number; structuralCaught: number }
}

// ---------- Ficha completa y modelo (lo que enseñaba el dashboard de Diego) ----------

export type Contribution = { text: string; shap: number; block: string }

export type BenchmarkRow = { kpi: string; n: number; p25: number; p50: number; p75: number }

export type Scenario = {
  id: string
  label: string
  before: number // salud del mes, sin suavizar
  after: number
  changes: Record<string, number | null>
  explanation: Contribution[]
}

export type CompanyProfile = {
  companyId: string
  name: string
  facts: {
    group: string; groupSize: number; country: string; erp: string; bank: string
    accounts: number; debtProducts: number; months: number; sizeCohort: string
  }
  now: {
    month: string; health: number; healthBand: HealthBand; trajectory: string; signal: string
    p: number; pDelta1m: number | null; pModelA: number | null
  }
  history: { month: string; health: number; smooth: number; modelA: number | null; deteriorated: boolean }[]
  treasury: {
    month: string; cash: number | null; inflow: number | null; outflow: number | null
    payDelay: number | null; collectDelay: number | null; overdueShare: number | null; interestCharges: number | null
  }[]
  shap: Contribution[]
  changes: { after: string; before: string; direction: 'empeora' | 'mejora' }[]
  benchmark: {
    cohort: { size_cohort: string; country_group: string; group_bucket: string; fallback_to_size_only: boolean } | null
    rows: BenchmarkRow[]
    own: Record<string, number | null> | null
  }
  scenarios: Scenario[]
}

type Metrics = { auc_pr: number; auc_roc: number; brier: number; base_rate: number; n: number; 'p@50': number; r_top10pct?: number }

export type ModelReport = {
  version: string
  main_model: string
  n_features: number
  feature_blocks: Record<string, number>
  label: { embargo_months?: number; [k: string]: unknown }
  holdout: Record<string, Metrics & { 'r@top10pct': number }>
  lift: Record<string, { lift_mean: number; lift_ci: [number, number] }>
  ablation: Record<string, { delta_holdout: number; reference: string }>
  calibration: { brier_raw: number; brier_cal: number }
  shap_block_importance: { by_block_share: Record<string, number>; behavioural_share: number }
  top_features: { feature: string; label: string; block: string; mean_abs_shap: number }[]
  error_analysis: { confusion_top15pct?: Record<string, number>; fn_dominant_component?: unknown; reading?: string }
  cv: Record<string, { auc_pr_mean: number; auc_pr_std: number }>
  anticipation: {
    definition: string; out_of_sample_from: string; n_events: number; share_anticipated: number
    lead_months_median: number; lead_distribution: Record<string, number>; false_alert_rate: number; band_flip_rate: number
  }
  holdout_unseen_companies: {
    n_unseen_companies: number
    lgbm_A: { unseen: Metrics }
    lgbm_B: { unseen: Metrics; seen_same_model: Metrics }
    lift_lgbm: { lift_mean: number; lift_ci: [number, number] }
  }
  figures: string[]
}

// ---------- TellMe: la IA de Embat (pipeline/src/tellme.py, precalculado) ----------

export type InsightKind = 'trend' | 'anomaly' | 'risk' | 'opportunity' | 'action'
export type Severity = 'info' | 'watch' | 'alert'

export type Insight = {
  id: string
  kind: InsightKind
  severity: Severity
  title: string
  explanation: string
  evidence: { label: string; value: string }[]
  action?: string
}

export type TellMe = {
  scope: 'company' | 'portfolio'
  companyId?: string
  headline: string
  summary: string
  insights: Insight[]
  glossary: { term: string; plain: string }[]
  generatedAt: string
  model: string
}
