import type { HealthBand } from '../api/types'
import { HEALTH_BAND_COLOR } from './charts'
import './shared.css'

/** Umbrales de banda fina del motor (pipeline/src/config.py). Se replican aquí
 *  solo para colorear cuando la banda no viene con el dato. */
export function healthBandOf(score: number): HealthBand {
  if (score >= 90) return 'sólida'
  if (score >= 75) return 'sana'
  if (score >= 50) return 'vigilar'
  return 'riesgo'
}

const R = 40
const CX = 50
const CY = 50

/** Dos decimales bastan en un SVG de 100 de ancho, y así los extremos caen redondos
 *  (sin(180°) no es exactamente 0 en coma flotante). */
const round = (n: number) => Math.round(n * 100) / 100

/** Punto del arco para una salud 0-100, sobre un semicírculo de 180° a 0°.
 *  Exportado para poder probar la geometría sin montar el SVG. */
export function gaugePoint(score: number, radius = R): { x: number; y: number } {
  const clamped = Math.max(0, Math.min(100, score))
  const rad = ((180 - clamped * 1.8) * Math.PI) / 180
  return { x: round(CX + radius * Math.cos(rad)), y: round(CY - radius * Math.sin(rad)) }
}

export function arcPath(score: number): string {
  const { x, y } = gaugePoint(score)
  return `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${x} ${y}`
}

export type GaugeProps = {
  score: number
  band?: HealthBand
  size?: 'sm' | 'md'
  /** Texto que acompaña a la puntuación en el lector de pantalla. */
  label?: string
}

/** Velocímetro de salud: arco de 0 a 100 con la puntuación dentro. La aguja es una marca
 *  fina que no llega al centro: señala sin ensuciar el arco.
 *  Todo el color sale de tokens, así que el modo oscuro funciona sin tocar nada. */
export function Gauge({ score, band, size = 'sm', label }: GaugeProps) {
  const b = band ?? healthBandOf(score)
  const color = HEALTH_BAND_COLOR[b]
  const desde = gaugePoint(score, R - 11)
  const hasta = gaugePoint(score, R + 3)
  const shown = score.toLocaleString('es-ES', { maximumFractionDigits: 1 })

  return (
    <svg
      className={`gauge gauge-${size}`} viewBox="0 0 100 74" role="img"
      aria-label={`Salud ${shown} de 100${label ? `, ${label}` : `, banda ${b}`}`}
    >
      <path d={arcPath(100)} fill="none" stroke="var(--color-border)" strokeWidth="6" strokeLinecap="round" />
      <path d={arcPath(score)} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" />
      <line
        x1={desde.x} y1={desde.y} x2={hasta.x} y2={hasta.y}
        stroke="var(--color-text)" strokeWidth="1.5" strokeLinecap="round"
      />
      <text x={CX} y="72" textAnchor="middle" className="gauge-value" fill={color}>{shown}</text>
    </svg>
  )
}
