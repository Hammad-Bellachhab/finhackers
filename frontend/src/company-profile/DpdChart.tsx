import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDecimal, formatMonth } from '../shared/format'
import { AXIS_LINE, AXIS_TICK, GRID_STROKE, type ProfilePoint } from './chartTheme'
import { ChartTooltip } from './ChartTooltip'

/** Mediana de la cartera en días de retraso; misma referencia que usa la explicación. */
const PORTFOLIO_MEDIAN_DPD = 8

export function DpdChart({ data }: { data: ProfilePoint[] }) {
  const first = data[0]
  const last = data[data.length - 1]
  if (!first || !last) return null

  return (
    <figure
      className="chart"
      role="img"
      aria-label={`Retraso medio de pago: de ${formatDecimal(first.dpd)} días en ${formatMonth(first.month)} a ${formatDecimal(last.dpd)} días en ${formatMonth(last.month)}`}
    >
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis dataKey="month" tickFormatter={formatMonth} interval={5} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
          <YAxis domain={[0, 'auto']} tick={AXIS_TICK} axisLine={false} tickLine={false} width={32} />
          <ReferenceLine
            y={PORTFOLIO_MEDIAN_DPD}
            stroke="var(--ink-faint)"
            strokeDasharray="4 4"
            label={{ value: 'Mediana de la cartera', position: 'insideBottomLeft', fill: 'var(--ink-muted)', fontSize: 12 }}
          />
          <Tooltip content={<ChartTooltip formatValue={(v) => `${formatDecimal(v)} días`} />} cursor={{ stroke: 'var(--ink-faint)' }} />
          <Line type="monotone" dataKey="dpd" stroke="var(--ink)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: 'var(--ink)' }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  )
}
