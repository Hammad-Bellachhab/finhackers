import type { RiskBand } from '../api'
import { bandLabel } from './format'
import './shared.css'

export function BandBadge({ band }: { band: RiskBand }) {
  return <span className={`band band--${band}`}>{bandLabel(band)}</span>
}
