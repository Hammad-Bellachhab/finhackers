import { formatMonthLong } from '../shared/format'

interface ChartTooltipProps {
  active?: boolean
  payload?: ReadonlyArray<{ value?: number | string }>
  label?: string | number
  formatValue: (value: number) => string
}

/** Tooltip de Recharts con los tokens de tema: borde fino, sin sombra. */
export function ChartTooltip({ active, payload, label, formatValue }: ChartTooltipProps) {
  const first = payload?.[0]
  if (!active || !first || typeof first.value !== 'number') return null
  return (
    <div className="chart-tooltip">
      <p className="t-small muted">{formatMonthLong(String(label))}</p>
      <p className="t-mono">{formatValue(first.value)}</p>
    </div>
  )
}
