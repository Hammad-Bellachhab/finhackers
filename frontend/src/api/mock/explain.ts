import type { ScoreExplanation } from '../types'
import { latestScore, type CompanyRecord } from './dataset'
import { round } from './random'

const NBSP = ' '

function formatInt(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function formatPercent(fraction: number): string {
  return `${round(fraction * 100, 1).toString().replace('.', ',')}${NBSP}%`
}

interface Factor {
  feature: string
  contribution: number
  describe: () => string
}

/** Mediana de DPD de la cartera, referencia para el factor de nivel. */
const PORTFOLIO_MEDIAN_DPD = 8

/**
 * Contribuciones en puntos de score, con signo (positivo = sube el riesgo). Es una
 * aproximación coherente con los KPIs mostrados, no un cálculo SHAP real.
 */
function buildFactors(rec: CompanyRecord): Factor[] {
  const now = rec.kpis[rec.kpis.length - 1]
  const before = rec.kpis[rec.kpis.length - 4]
  if (!now || !before) return []

  const dpdNow = Math.round(now.dpdMean)
  const dpdBefore = Math.round(before.dpdMean)
  const liquidityChange = now.liquidityBalance / Math.max(before.liquidityBalance, 1) - 1

  return [
    {
      feature: 'Tendencia del retraso medio de pago',
      contribution: (now.dpdMean - before.dpdMean) * 1.1,
      describe: () => {
        if (dpdNow - dpdBefore >= 1) return `El retraso medio de pago ha pasado de ${dpdBefore} a ${dpdNow} días en los últimos tres meses`
        if (dpdBefore - dpdNow >= 1) return `El retraso medio de pago ha bajado de ${dpdBefore} a ${dpdNow} días en los últimos tres meses`
        return `El retraso medio de pago se mantiene en torno a ${dpdNow} días desde hace tres meses`
      },
    },
    {
      feature: 'Nivel del retraso medio de pago',
      contribution: (now.dpdMean - PORTFOLIO_MEDIAN_DPD) * 0.55,
      describe: () =>
        dpdNow >= PORTFOLIO_MEDIAN_DPD
          ? `El retraso medio de pago, de ${dpdNow} días, supera la mediana de la cartera (${PORTFOLIO_MEDIAN_DPD} días)`
          : `El retraso medio de pago, de ${dpdNow} días, está por debajo de la mediana de la cartera (${PORTFOLIO_MEDIAN_DPD} días)`,
    },
    {
      feature: 'Evolución de la liquidez',
      contribution: -liquidityChange * 28,
      describe: () => {
        const pct = Math.round(Math.abs(liquidityChange) * 100)
        const balance = `${formatInt(now.liquidityBalance)}${NBSP}€`
        if (pct < 2) return `La liquidez se mantiene estable en ${balance}`
        return liquidityChange < 0
          ? `La liquidez ha caído un ${pct}${NBSP}% en los últimos tres meses, hasta ${balance}`
          : `La liquidez ha subido un ${pct}${NBSP}% en los últimos tres meses, hasta ${balance}`
      },
    },
    {
      feature: 'Facturas vencidas sobre el total',
      contribution: (now.overdueInvoiceRatio - 0.12) * 70 + (now.overdueInvoiceRatio - before.overdueInvoiceRatio) * 40,
      describe: () =>
        `Las facturas vencidas suponen el ${formatPercent(now.overdueInvoiceRatio)} del total, frente al ${formatPercent(before.overdueInvoiceRatio)} de hace tres meses`,
    },
    {
      feature: 'Cobros sobre pagos',
      contribution: -(now.collectionsToPaymentsRatio - 1) * 22,
      describe: () =>
        `Los cobros cubren el ${Math.round(now.collectionsToPaymentsRatio * 100)}${NBSP}% de los pagos, frente al ${Math.round(before.collectionsToPaymentsRatio * 100)}${NBSP}% de hace tres meses`,
    },
  ]
}

export function buildExplanation(rec: CompanyRecord): ScoreExplanation {
  const factors = buildFactors(rec).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
  const top = factors[0]
  const score = latestScore(rec)
  if (!top) {
    return { companyId: rec.company.id, date: score.date, topFactors: [], naturalLanguageSummary: 'Aún no hay datos suficientes para explicar este score.' }
  }
  const direction = top.contribution >= 0 ? 'increases' : 'decreases'
  const closing = direction === 'increases' ? 'Es el factor que más eleva su riesgo.' : 'Es el factor que más lo reduce.'
  return {
    companyId: rec.company.id,
    date: score.date,
    topFactors: factors.slice(0, 4).map((f) => ({
      feature: f.feature,
      contribution: round(Math.abs(f.contribution), 1),
      direction: f.contribution >= 0 ? 'increases' : 'decreases',
    })),
    naturalLanguageSummary: `${top.describe()}. ${closing}`,
  }
}
