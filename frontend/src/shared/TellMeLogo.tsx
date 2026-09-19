import { useId } from 'react'
import './shared.css'

export type TellMeLogoProps = {
  className?: string
  size?: number
  strokeWidth?: number
}

// Estrella de 5 puntas de un solo trazo (pentagrama), como el logo de TellMe:
// vértices de un pentágono de radio 38 unidos saltando uno (0 → 2 → 4 → 1 → 3).
const STAR = 'M50 12 L72.3 80.7 L13.9 38.3 L86.1 38.3 L27.7 80.7 Z'

/** Logo de TellMe: estrella azul → violeta con puntas redondeadas. Se anima con CSS (.tellme-logo-svg). */
export function TellMeLogo({ className = '', size = 20, strokeWidth = 11 }: TellMeLogoProps) {
  const grad = useId()
  return (
    <svg
      className={`tellme-logo-svg ${className}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={grad} x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4f7bff" />
          <stop offset="100%" stopColor="#7b5cf5" />
        </linearGradient>
      </defs>
      <path
        d={STAR} stroke={`url(#${grad})`} strokeWidth={strokeWidth}
        strokeLinejoin="round" strokeLinecap="round"
      />
    </svg>
  )
}

/** "TellMe" con el degradado de la marca. */
export function TellMeWordmark() {
  return <span className="tellme-wordmark">TellMe</span>
}
