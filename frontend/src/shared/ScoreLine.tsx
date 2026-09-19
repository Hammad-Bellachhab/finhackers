import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { ScorePoint } from '../api/types'
import { formatMonth } from './format'
import './shared.css'

/** Dominio vertical derivado de los datos, con 10 puntos de margen y recortado
 *  a 0-100. Exportado para poder probarlo sin montar la grafica.
 *  Se calcula de los datos recibidos, asi que aguanta lo que devuelva el motor. */
export function yDomain(points: ScorePoint[]): [number, number] {
  if (points.length === 0) return [0, 100]
  const vals = points.map((p) => p.score)
  return [
    Math.max(0, Math.floor(Math.min(...vals) - 10)),
    Math.min(100, Math.ceil(Math.max(...vals) + 10)),
  ]
}

type Row = { month: string; score?: number; proj?: number; low?: number; high?: number }

export type ScoreLineProps = {
  series: ScorePoint[]
  projection?: ScorePoint[]
  bandLow?: ScorePoint[]
  bandHigh?: ScorePoint[]
  markers?: { month: string; label: string; color?: string }[]
  height?: number
}

export function ScoreLine({
  series, projection = [], bandLow = [], bandHigh = [], markers = [], height = 260,
}: ScoreLineProps) {
  const rows: Row[] = series.map((p) => ({ month: p.month, score: p.score }))

  if (projection.length > 0 && series.length > 0) {
    // El primer punto proyectado engancha con el ultimo real para que la linea
    // no aparezca flotando.
    const ultimo = series[series.length - 1].score
    rows[rows.length - 1].proj = ultimo
    rows[rows.length - 1].low = ultimo
    rows[rows.length - 1].high = ultimo
    projection.forEach((p, i) => {
      rows.push({
        month: p.month,
        proj: p.score,
        low: bandLow[i]?.score,
        high: bandHigh[i]?.score,
      })
    })
  }

  const domain = yDomain([...series, ...projection, ...bandLow, ...bandHigh])

  return (
    <div className="score-line">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={rows} margin={{ top: 14, right: 12, bottom: 4, left: -18 }}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="month" tickFormatter={formatMonth} minTickGap={28}
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
            stroke="var(--color-border)"
          />
          <YAxis
            domain={domain} tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
            stroke="var(--color-border)" width={44} allowDataOverflow
          />
          <Tooltip
            labelFormatter={(m: string) => formatMonth(m)}
            contentStyle={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-text)',
            }}
          />
          {bandHigh.length > 0 && (
            <Area dataKey="high" stroke="none" fill="var(--color-accent)" fillOpacity={0.14}
                  isAnimationActive={false} connectNulls />
          )}
          {bandLow.length > 0 && (
            <Area dataKey="low" stroke="none" fill="var(--color-bg)" fillOpacity={1}
                  isAnimationActive={false} connectNulls />
          )}
          <Line
            dataKey="score" name="Score" stroke="var(--chart-1)" strokeWidth={2}
            dot={false} isAnimationActive={false} connectNulls
          />
          <Line
            dataKey="proj" name="Previsión" stroke="var(--chart-2)" strokeWidth={2}
            strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls
          />
          {markers.map((mk) => (
            <ReferenceLine
              key={mk.month} x={mk.month} stroke={mk.color ?? 'var(--color-trend-down)'}
              strokeDasharray="3 3"
              label={{ value: mk.label, position: 'top', fill: 'var(--color-text-muted)', fontSize: 11 }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
