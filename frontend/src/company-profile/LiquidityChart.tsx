import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatEuros, formatEurosCompact, formatMonth } from '../shared/format'
import { AXIS_LINE, AXIS_TICK, GRID_STROKE, type ProfilePoint } from './chartTheme'
import { ChartTooltip } from './ChartTooltip'

const RECENT_MONTHS = 3

/** Saldo de liquidez mensual en barras: los últimos tres meses, los de la explicación, van en tinta plena. */
export function LiquidityChart({ data }: { data: ProfilePoint[] }) {
  const first = data[0]
  const last = data[data.length - 1]
  if (!first || !last) return null

  return (
    <figure
      className="chart"
      role="img"
      aria-label={`Saldo de liquidez: de ${formatEuros(first.liquidity)} en ${formatMonth(first.month)} a ${formatEuros(last.liquidity)} en ${formatMonth(last.month)}`}
    >
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis dataKey="month" tickFormatter={formatMonth} interval={5} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
          <YAxis tickFormatter={formatEurosCompact} tick={AXIS_TICK} axisLine={false} tickLine={false} width={64} />
          <Tooltip content={<ChartTooltip formatValue={formatEuros} />} cursor={{ fill: 'var(--hover)' }} />
          <Bar dataKey="liquidity" radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {data.map((point, index) => (
              <Cell key={point.month} fill={index >= data.length - RECENT_MONTHS ? 'var(--ink)' : 'var(--ink-faint)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </figure>
  )
}
