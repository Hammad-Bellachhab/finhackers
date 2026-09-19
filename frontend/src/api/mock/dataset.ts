import type {
  Band, CompanyScore, Decision, Driver, Forecast, Metric, MetricId, ScorePoint, Trend,
} from '../types'
import { makeRng } from './rng'
import { companyName } from './names'

export type MockCompany = {
  score: CompanyScore
  forecast: Forecast
  decisions: Decision[]
}

const N_COMPANIES = 1286
const MONTHS = 24
const SEED = 20260919

/** Etiquetas 'YYYY-MM' de los 24 meses del dataset: 2024-09 .. 2026-08. */
function monthLabels(): string[] {
  const out: string[] = []
  let y = 2024
  let m = 9
  for (let i = 0; i < MONTHS; i++) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return out
}

const MONTHS_LABELS = monthLabels()

function addMonths(label: string, n: number): string {
  const [y, m] = label.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

function clamp(v: number): number {
  return Math.max(2, Math.min(98, Math.round(v)))
}

function bandOf(score: number): Band {
  if (score >= 67) return 'healthy'
  if (score >= 40) return 'stable'
  return 'risk'
}

function trendOf(delta3m: number): Trend {
  if (delta3m >= 3) return 'up'
  if (delta3m <= -3) return 'down'
  return 'flat'
}

const DRIVER_POOL: { id: string; label: string; detail: string }[] = [
  { id: 'dso', label: 'El cobro se alarga', detail: 'Tus clientes tardan más en pagarte que hace un año.' },
  { id: 'dpo', label: 'Pagas más tarde', detail: 'Estás estirando el pago a proveedores.' },
  { id: 'dscr', label: 'Cobertura de deuda', detail: 'El flujo operativo cubre peor las cuotas.' },
  { id: 'cash_days', label: 'Colchón de caja', detail: 'Días de caja disponibles al ritmo de gasto actual.' },
  { id: 'credit_usage', label: 'Uso de líneas', detail: 'Proporción dispuesta sobre el límite concedido.' },
  { id: 'concentration', label: 'Concentración de clientes', detail: 'Peso del mayor cliente sobre tus cobros.' },
]

function buildMetrics(r: () => number, score: number): Metric[] {
  const dso = Math.round(35 + (100 - score) * 0.5 + r() * 12)
  const dpo = Math.round(30 + r() * 25)
  const dscr = Number((0.7 + (score / 100) * 1.4 + r() * 0.2).toFixed(2))
  const cashDays = Math.round(15 + (score / 100) * 120 + r() * 20)
  const usage = Number((0.9 - (score / 100) * 0.55 + r() * 0.1).toFixed(2))
  const conc = Number((0.15 + r() * 0.3).toFixed(2))
  return [
    { id: 'dso', label: 'Días en cobrar', value: dso, unit: 'days', reference: 45,
      status: dso > 60 ? 'breach' : dso > 50 ? 'watch' : 'ok' },
    { id: 'dpo', label: 'Días en pagar', value: dpo, unit: 'days', reference: 45, status: 'ok' },
    { id: 'ccc', label: 'Ciclo de caja', value: dso - dpo, unit: 'days', reference: 30,
      status: dso - dpo > 45 ? 'watch' : 'ok' },
    { id: 'dscr', label: 'Cobertura del servicio de deuda', value: dscr, unit: 'ratio', reference: 1.25,
      status: dscr < 1.25 ? 'breach' : dscr < 1.4 ? 'watch' : 'ok' },
    { id: 'cash_days', label: 'Días de caja', value: cashDays, unit: 'days', reference: 60,
      status: cashDays < 60 ? 'breach' : cashDays < 90 ? 'watch' : 'ok' },
    { id: 'credit_usage', label: 'Uso de líneas', value: usage, unit: 'pct', reference: 0.8,
      status: usage > 0.8 ? 'breach' : usage > 0.65 ? 'watch' : 'ok' },
    { id: 'concentration', label: 'Concentración de clientes', value: conc, unit: 'pct', reference: 0.3,
      status: conc > 0.3 ? 'watch' : 'ok' },
  ]
}

function buildDrivers(r: () => number, trend: Trend): Driver[] {
  const picks = [...DRIVER_POOL].sort(() => r() - 0.5).slice(0, 3)
  return picks.map((p, i) => {
    const sign = trend === 'up' ? 1 : trend === 'down' ? -1 : r() > 0.5 ? 1 : -1
    const impact = Number((sign * (1 + r() * 5) * (1 - i * 0.2)).toFixed(1))
    return {
      id: p.id,
      label: p.label,
      direction: impact > 0 ? ('up' as const) : ('down' as const),
      impact,
      since: MONTHS_LABELS[Math.floor(12 + r() * 10)],
      detail: p.detail,
    }
  })
}

const LEVERS = {
  collect_faster: { title: 'Acelera el cobro', metricId: 'dso' as MetricId,
    rationale: 'Tu DSO supera en más de 10 días tu mediana de los últimos 12 meses.',
    caution: null },
  pay_slower: { title: 'Negocia más plazo con proveedores', metricId: 'dpo' as MetricId,
    rationale: 'Pagas antes que tu histórico mientras la caja está tensa.',
    caution: 'Forzar el plazo daña la relación y acaba en peores precios. Negocia, no impongas.' },
  refinance: { title: 'Refinancia la deuda', metricId: 'dscr' as MetricId,
    rationale: 'Tu cobertura del servicio de deuda cae por debajo del 1,25 que exige la banca.',
    caution: null },
  amortise: { title: 'Amortiza deuda cara', metricId: 'dscr' as MetricId,
    rationale: 'Tienes colchón de caja holgado y deuda a tipo alto.', caution: null },
  open_credit_line: { title: 'Abre línea de crédito', metricId: 'cash_days' as MetricId,
    rationale: 'Tus días de caja bajan de 60. Conviene el colchón antes de necesitarlo.',
    caution: null },
  reduce_usage: { title: 'Reduce el uso de tus líneas', metricId: 'credit_usage' as MetricId,
    rationale: 'Tienes dispuesto más del 80 % del límite concedido, señal clásica de estrés.',
    caution: null },
  diversify: { title: 'Diversifica clientes', metricId: 'concentration' as MetricId,
    rationale: 'Un solo cliente concentra más del 30 % de tus cobros.', caution: null },
  pay_on_time: { title: 'Prioriza tus pagos', metricId: 'dpo' as MetricId,
    rationale: 'Estás pagando tus facturas tarde, y eso se deteriora antes que la caja.',
    caution: null },
}

function buildDecisions(r: () => number, metrics: Metric[], id: string): Decision[] {
  const by = (m: MetricId) => metrics.find((x) => x.id === m)!
  const out: Decision[] = []
  const push = (lever: keyof typeof LEVERS, target: number, cash: number, score: number) => {
    const L = LEVERS[lever]
    out.push({
      id: `${id}-${lever}`, lever, title: L.title, rationale: L.rationale,
      metricId: L.metricId, currentValue: by(L.metricId).value, targetValue: target,
      cashImpact: Math.round(cash), scoreImpact: Number(score.toFixed(1)), caution: L.caution,
    })
  }
  if (by('dso').status !== 'ok') push('collect_faster', 45, (by('dso').value - 45) * (2000 + r() * 6000), 3 + r() * 5)
  if (by('dscr').status !== 'ok') push('refinance', 1.35, 0, 2 + r() * 4)
  if (by('cash_days').status === 'breach') push('open_credit_line', 90, 40000 + r() * 120000, 1 + r() * 3)
  if (by('credit_usage').status === 'breach') push('reduce_usage', 0.6, 0, 2 + r() * 3)
  if (by('concentration').status !== 'ok') push('diversify', 0.25, 0, 1 + r() * 2)
  if (by('cash_days').status === 'ok' && by('dscr').status === 'ok') push('amortise', 1.6, 12000 + r() * 30000, 1 + r() * 2)
  if (out.length === 0) push('pay_on_time', by('dpo').value, 5000 + r() * 10000, 0.5 + r())
  return out.sort((a, b) => b.cashImpact - a.cashImpact || b.scoreImpact - a.scoreImpact)
}

function buildOne(i: number): MockCompany {
  const r = makeRng(SEED + i * 7919)
  const companyId = `c-${String(i + 1).padStart(4, '0')}`

  // Trayectoria: nivel de partida mas una deriva, con ruido mensual.
  const start = 25 + r() * 60
  const drift = (r() - 0.45) * 2.2 // sesgo ligeramente positivo para tener las dos caras
  const noise = 1.5 + r() * 2.5
  const dipAt = r() < 0.25 ? 14 + Math.floor(r() * 8) : -1 // bache puntual

  const series: ScorePoint[] = MONTHS_LABELS.map((month, m) => {
    let v = start + drift * m + (r() - 0.5) * noise * 2
    if (dipAt >= 0 && m === dipAt) v -= 9 + r() * 6 // el bache
    return { month, score: clamp(v) }
  })

  const score = series[series.length - 1].score
  const delta1m = score - series[series.length - 2].score
  const delta3m = score - series[series.length - 4].score
  const band = bandOf(score)
  const trend = trendOf(delta3m)
  const heldOut = i % 19 === 0 // ~68 empresas

  const metrics = buildMetrics(r, score)
  const drivers = buildDrivers(r, trend)

  // Proyeccion determinista: prolonga la pendiente de los ultimos 6 meses,
  // amortiguada, con banda de incertidumbre que se abre con el horizonte.
  const slope = (score - series[series.length - 7].score) / 6
  const horizon: ScorePoint[] = []
  const bandLow: ScorePoint[] = []
  const bandHigh: ScorePoint[] = []
  for (let h = 1; h <= 6; h++) {
    const month = addMonths(MONTHS_LABELS[MONTHS - 1], h)
    const v = clamp(score + slope * h * 0.7)
    horizon.push({ month, score: v })
    bandLow.push({ month, score: clamp(v - 2 - h * 1.2) })
    bandHigh.push({ month, score: clamp(v + 2 + h * 1.2) })
  }

  const baches = dipAt >= 0 && dipAt >= MONTHS - 6 && trend !== 'down'
  const stability: Forecast['stability'] = baches ? 'dip' : trend === 'down' ? 'structural' : 'dip'
  const stabilityNote = stability === 'dip'
    ? 'Es un bache puntual, no un deterioro. No hace falta actuar.'
    : 'El deterioro es estructural: lleva varios meses en la misma dirección.'

  const monthsAhead = 2 + Math.floor(r() * 5)
  const detection = trend === 'down'
    ? {
        detectedAt: MONTHS_LABELS[MONTHS - 1 - monthsAhead],
        evidentAt: MONTHS_LABELS[MONTHS - 1],
        monthsAhead,
      }
    : null

  return {
    score: {
      companyId, name: companyName(companyId), score, band, trend,
      delta1m, delta3m, series, drivers, metrics, heldOut,
    },
    forecast: { companyId, horizon, bandLow, bandHigh, stability, stabilityNote, detection },
    decisions: buildDecisions(r, metrics, companyId),
  }
}

let cache: MockCompany[] | null = null

/** Las 1286 empresas del mock. Determinista: misma salida en cada llamada. */
export function buildDataset(): MockCompany[] {
  if (!cache) cache = Array.from({ length: N_COMPANIES }, (_, i) => buildOne(i))
  return cache
}
