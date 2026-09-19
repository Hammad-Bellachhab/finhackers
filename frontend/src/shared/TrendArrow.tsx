import type { Trend } from '../api/types'
import './shared.css'

const LABEL: Record<Trend, string> = {
  up: 'tendencia al alza',
  down: 'tendencia a la baja',
  flat: 'sin tendencia clara',
}

const GLYPH: Record<Trend, string> = { up: '▲', down: '▼', flat: '—' }

export function TrendArrow({ trend }: { trend: Trend }) {
  return (
    <span className={`trend trend-${trend}`} aria-label={LABEL[trend]} role="img">
      {GLYPH[trend]}
    </span>
  )
}
