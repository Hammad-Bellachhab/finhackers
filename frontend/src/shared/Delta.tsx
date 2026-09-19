import { formatSigned } from './format'
import './shared.css'

interface DeltaProps {
  value: number
  /** Por debajo de este valor absoluto el cambio se considera ruido y no se colorea. */
  noiseBelow?: number
  size?: 'table' | 'large'
}

/** Variación del score vs. el mes anterior. Positivo = más riesgo. */
export function Delta({ value, noiseBelow = 3, size = 'table' }: DeltaProps) {
  const isNoise = Math.abs(value) < noiseBelow
  const tone = isNoise ? 'flat' : value > 0 ? 'up' : 'down'
  const label =
    value === 0
      ? 'Sin cambios respecto al mes anterior'
      : `${value > 0 ? 'Sube' : 'Baja'} ${Math.abs(value)} ${Math.abs(value) === 1 ? 'punto' : 'puntos'} respecto al mes anterior`

  return (
    <span className={`delta delta--${tone} delta--${size}`} role="img" aria-label={label}>
      <span className="delta__mark" aria-hidden="true">
        {value > 0 ? '▲' : value < 0 ? '▼' : ''}
      </span>
      <span aria-hidden="true">{formatSigned(value)}</span>
    </span>
  )
}
