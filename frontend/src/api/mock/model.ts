import type { AblationBlock, GlobalShapFeature, ModelInfo, ModelMetric, PrCurvePoint } from '../types'
import { MODEL_VERSION, N_COMPANIES } from './dataset'
import { round } from './random'

/** Prevalencia de la clase positiva con el umbral en el percentil 85 (arquitectura.pdf). */
const POSITIVE_RATE = 0.15
const AUC_PR_A = 0.55
const AUC_PR_B = 0.71

/**
 * Curva PR paramétrica p(r) = base + (0,97 - base) * (1 - r)^k con k elegido para que
 * el área bajo la curva coincida con el AUC-PR objetivo.
 */
function precisionAt(recall: number, targetAuc: number): number {
  const top = 0.97
  const k = (top - POSITIVE_RATE) / (targetAuc - POSITIVE_RATE) - 1
  const wiggle = 0.006 * Math.sin(recall * 23 + targetAuc * 10)
  return round(Math.max(POSITIVE_RATE, POSITIVE_RATE + (top - POSITIVE_RATE) * (1 - recall) ** k + wiggle), 3)
}

function buildPrCurve(): PrCurvePoint[] {
  const points: PrCurvePoint[] = []
  for (let i = 0; i <= 40; i++) {
    const recall = round(i / 40, 3)
    points.push({ recall, precisionA: precisionAt(recall, AUC_PR_A), precisionB: precisionAt(recall, AUC_PR_B) })
  }
  return points
}

const COMPARISON: ModelMetric[] = [
  {
    key: 'auc-pr',
    label: 'AUC-PR',
    higherIsBetter: true,
    modelA: { value: AUC_PR_A, ciLow: 0.51, ciHigh: 0.59 },
    modelB: { value: AUC_PR_B, ciLow: 0.67, ciHigh: 0.75 },
  },
  {
    key: 'auc-roc',
    label: 'AUC-ROC',
    higherIsBetter: true,
    modelA: { value: 0.77, ciLow: 0.74, ciHigh: 0.8 },
    modelB: { value: 0.88, ciLow: 0.86, ciHigh: 0.9 },
  },
  {
    key: 'precision-top50',
    label: 'Acierto en las 50 empresas más arriesgadas',
    higherIsBetter: true,
    modelA: { value: 0.62, ciLow: 0.48, ciHigh: 0.74 },
    modelB: { value: 0.82, ciLow: 0.7, ciHigh: 0.91 },
  },
  {
    key: 'brier',
    label: 'Brier score',
    higherIsBetter: false,
    modelA: { value: 0.118, ciLow: 0.108, ciHigh: 0.129 },
    modelB: { value: 0.089, ciLow: 0.08, ciHigh: 0.098 },
  },
]

const ABLATION: AblationBlock[] = [
  { block: 'B. Comportamiento de pago', description: 'DPD, tendencia, facturas vencidas, orden de prelación', aucPrDrop: 0.089 },
  { block: 'C. Dinámica de liquidez', description: 'Cobros/pagos, días de caja, descubiertos, intereses', aucPrDrop: 0.052 },
  { block: 'E. Red y grupo', description: 'Riesgo de las empresas hermanas, bancos compartidos', aucPrDrop: 0.031 },
  { block: 'D. Concentración', description: 'HHI de contrapartidas, peso del mayor cliente', aucPrDrop: 0.024 },
  { block: 'F. Texto y calidad del dato', description: 'Términos de estrés, movimientos sin conciliar', aucPrDrop: 0.017 },
  { block: 'A. Estructurales', description: 'Deuda, saldo, antigüedad, sector, tamaño del grupo', aucPrDrop: 0.012 },
]

const GLOBAL_SHAP: GlobalShapFeature[] = [
  { feature: 'Tendencia del retraso medio de pago (6 meses)', meanAbsContribution: 6.8, direction: 'increases' },
  { feature: 'Retraso medio de pago del último mes', meanAbsContribution: 5.9, direction: 'increases' },
  { feature: 'Ratio de facturas vencidas', meanAbsContribution: 4.7, direction: 'increases' },
  { feature: 'Ratio cobros sobre pagos', meanAbsContribution: 4.1, direction: 'decreases' },
  { feature: 'Tendencia de la liquidez', meanAbsContribution: 3.6, direction: 'decreases' },
  { feature: 'Días de caja', meanAbsContribution: 3.2, direction: 'decreases' },
  { feature: 'Retraso en nóminas y Seguridad Social', meanAbsContribution: 3.0, direction: 'increases' },
  { feature: 'Riesgo medio de las empresas hermanas del grupo', meanAbsContribution: 2.6, direction: 'increases' },
  { feature: 'Peso del mayor cliente en los cobros', meanAbsContribution: 2.3, direction: 'increases' },
  { feature: 'Días en descubierto', meanAbsContribution: 2.1, direction: 'increases' },
  { feature: 'Movimientos sin conciliar', meanAbsContribution: 1.7, direction: 'increases' },
  { feature: 'Deuda viva sobre saldo', meanAbsContribution: 1.4, direction: 'increases' },
  { feature: 'Antigüedad en la plataforma', meanAbsContribution: 1.1, direction: 'decreases' },
  { feature: 'Número de bancos', meanAbsContribution: 0.8, direction: 'decreases' },
]

export function buildModelInfo(asOf: string): ModelInfo {
  const scored = new Date(`${asOf}T00:00:00`)
  const trained = new Date(scored)
  trained.setDate(trained.getDate() - 6)
  const iso = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  return {
    modelVersion: MODEL_VERSION,
    aucPr: AUC_PR_B,
    aucPrCiLow: 0.67,
    aucPrCiHigh: 0.75,
    universeSize: N_COMPANIES,
    positiveRate: POSITIVE_RATE,
    trainedAt: iso(trained),
    scoredAt: asOf,
    observationMonths: 12,
    outcomeMonths: 6,
    comparison: COMPARISON,
    prCurve: buildPrCurve(),
    ablation: ABLATION,
    globalShap: GLOBAL_SHAP,
  }
}
