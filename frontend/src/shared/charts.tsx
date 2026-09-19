import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Contribution } from '../api/types'
import { formatMonth } from './format'
import './shared.css'

/** Estilo común de ejes y tooltip: todo con tokens, así claro/oscuro sale solo. */
export const axis = {
  tick: { fill: 'var(--color-text-muted)', fontSize: 11 },
  stroke: 'var(--color-border)',
}

export const monthAxis = { ...axis, dataKey: 'month', tickFormatter: formatMonth, minTickGap: 24 }

export const tooltip = {
  labelFormatter: (m: unknown) => (typeof m === 'string' && /^\d{4}-\d{2}$/.test(m) ? formatMonth(m) : String(m)),
  contentStyle: {
    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)', color: 'var(--color-text)', fontSize: 12,
  },
}

/** Colores de las cuatro bandas finas del motor. */
export const HEALTH_BAND_COLOR: Record<string, string> = {
  'sólida': 'var(--color-success-strong)',
  sana: 'var(--color-success)',
  vigilar: 'var(--color-warning)',
  riesgo: 'var(--color-danger)',
}

export const BLOCK_NAME: Record<string, string> = {
  A: 'Estructural', B: 'Comportamiento de pago', C: 'Liquidez',
  D: 'Concentración', E: 'Grupo / banco', F: 'Texto y calidad',
}

/** Barras horizontales de contribución (SHAP): rojo sube el riesgo, verde lo baja. */
export function ContributionBars({ items }: { items: Contribution[] }) {
  if (items.length === 0) return null
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, items.length * 34)}>
      <BarChart data={items} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 8 }}>
        <XAxis type="number" {...axis} />
        <YAxis type="category" dataKey="text" width={260} {...axis} tick={{ ...axis.tick, fontSize: 11 }} />
        <Tooltip {...tooltip} formatter={(v) => [Number(v).toFixed(3), 'contribución al riesgo']} />
        <Bar dataKey="shap" isAnimationActive={false}>
          {items.map((c, i) => (
            <Cell key={i} fill={c.shap > 0 ? 'var(--color-danger)' : 'var(--color-success)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Tarjeta con título para cada gráfica. */
export function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="panel">
      <h3>{title}</h3>
      {children}
      {note && <p className="panel-note">{note}</p>}
    </div>
  )
}
