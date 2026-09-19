import type { RiskBand } from './types'

/** Un score de 0 a 100 se agrupa en tres bandas; el alto es aproximadamente el 15 % superior. */
export const BAND_THRESHOLDS = { medio: 33, alto: 58 } as const

/** Subida mensual (puntos de score) a partir de la cual una empresa cuenta como "sube rápido". */
export const RISING_FAST_DELTA = 10

/** Por debajo de este tamaño de cohorte no se muestra benchmark. */
export const MIN_COHORT_SIZE = 10

export const DEFAULT_PAGE_SIZE = 50

export function bandFromScore(score: number): RiskBand {
  if (score >= BAND_THRESHOLDS.alto) return 'alto'
  if (score >= BAND_THRESHOLDS.medio) return 'medio'
  return 'bajo'
}
