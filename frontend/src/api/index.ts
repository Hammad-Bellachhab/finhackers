/*
 * Única puerta de entrada al dato para los componentes. Para pasar a la API real,
 * basta con exportar otra implementación de ScoringApi aquí.
 */
import { mockApi } from './mockApi'
import type { ScoringApi } from './types'

export const api: ScoringApi = mockApi

export * from './types'
export { BAND_THRESHOLDS, DEFAULT_PAGE_SIZE, MIN_COHORT_SIZE, RISING_FAST_DELTA, bandFromScore } from './constants'
