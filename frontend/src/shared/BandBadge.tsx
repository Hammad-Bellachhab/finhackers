import type { Band, Trend } from '../api/types'
import { TrendArrow } from './TrendArrow'
import './shared.css'

const LABEL: Record<Band, string> = {
  healthy: 'Sana',
  stable: 'Estable',
  risk: 'En riesgo',
}

/** Nivel y trayectoria juntos pero distinguibles: el relleno dice donde esta,
 *  la flecha dice hacia donde va. */
export function BandBadge({ band, trend }: { band: Band; trend: Trend }) {
  return (
    <span className={`badge badge-${band}`}>
      {LABEL[band]}
      <TrendArrow trend={trend} />
    </span>
  )
}
