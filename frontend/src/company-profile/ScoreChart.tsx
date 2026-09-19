import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BAND_THRESHOLDS } from '../api'
import { formatMonth } from '../shared/format'
import { AXIS_LINE, AXIS_TICK, GRID_STROKE, type ProfilePoint } from './chartTheme'
import { ChartTooltip } from './ChartTooltip'

interface ScoreChartProps {
  data: ProfilePoint[]
}

const RECENT_MONTHS = 3

/** Evolución del score a 24 meses. El tramo de los últimos tres meses coincide con el de la frase explicativa. */
export function ScoreChart({ data }: ScoreChartProps) {
  const first = data[0]
  const last = data[data.length - 1]
  const recentStart = data[data.length - 1 - RECENT_MONTHS]
  if (!first || !last || !recentStart) return null

  return (
    <figure
      className="chart"
      role="img"
      aria-label={`Evolución del score en 24 meses: de ${first.score} en ${formatMonth(first.month)} a ${last.score} en ${formatMonth(last.month)}`}
    >
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 20, right: 96, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis dataKey="month" tickFormatter={formatMonth} interval={3} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} />
          <ReferenceArea
            x1={recentStart.month}
            x2={last.month}
            fill="var(--accent)"
            fillOpacity={0.14}
            stroke="none"
            label={{ value: 'Últimos tres meses', position: 'insideTop', fill: 'var(--accent-text)', fontSize: 12 }}
          />
          <ReferenceLine
            y={BAND_THRESHOLDS.alto}
            stroke="var(--risk-high)"
            strokeDasharray="4 4"
            strokeOpacity={0.7}
            label={{ value: 'Riesgo alto', position: 'right', fill: 'var(--risk-high-text)', fontSize: 12 }}
          />
          <ReferenceLine
            y={BAND_THRESHOLDS.medio}
            stroke="var(--ink-faint)"
            strokeDasharray="4 4"
            label={{ value: 'Riesgo medio', position: 'right', fill: 'var(--ink-muted)', fontSize: 12 }}
          />
          <Tooltip content={<ChartTooltip formatValue={(v) => `Score ${v}`} />} cursor={{ stroke: 'var(--ink-faint)' }} />
          <Line type="monotone" dataKey="score" stroke="var(--ink)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: 'var(--ink)' }} isAnimationActive={false} />
          <ReferenceDot x={last.month} y={last.score} r={5} fill="var(--ink)" stroke="var(--surface)" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  )
}
