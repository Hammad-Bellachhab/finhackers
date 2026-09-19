/** Estilo común de los gráficos. Todo sale de los tokens de tema, así cambia con el tema. */
export const AXIS_TICK = {
  fill: 'var(--ink-muted)',
  fontSize: 12,
  fontFamily: 'var(--font-mono)',
} as const

export const AXIS_LINE = { stroke: 'var(--hairline)' } as const

export const GRID_STROKE = 'var(--hairline)'

export interface ProfilePoint {
  /** Mes en formato AAAA-MM. */
  month: string
  score: number
  dpd: number
  liquidity: number
}
