import './shared.css'

export type TellMeLogoProps = {
  className?: string
  size?: number
  strokeWidth?: number
}

/** Componente que pinta el logo oficial de TellMe (la estrella de 5 bucles redondeados entrelazados).
 *  Utiliza rectángulos redondeados rotados matemáticamente alrededor del centro. */
export function TellMeLogo({ className = '', size = 20, strokeWidth = 6 }: TellMeLogoProps) {
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
        <linearGradient id="tellme-logo-grad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5c92fe" />
          <stop offset="50%" stopColor="#b565f3" />
          <stop offset="100%" stopColor="#c357ec" />
        </linearGradient>
      </defs>
      <rect x="41" y="12" width="18" height="76" rx="9" stroke="url(#tellme-logo-grad)" strokeWidth={strokeWidth} transform="rotate(0 50 50)" />
      <rect x="41" y="12" width="18" height="76" rx="9" stroke="url(#tellme-logo-grad)" strokeWidth={strokeWidth} transform="rotate(72 50 50)" />
      <rect x="41" y="12" width="18" height="76" rx="9" stroke="url(#tellme-logo-grad)" strokeWidth={strokeWidth} transform="rotate(144 50 50)" />
      <rect x="41" y="12" width="18" height="76" rx="9" stroke="url(#tellme-logo-grad)" strokeWidth={strokeWidth} transform="rotate(216 50 50)" />
      <rect x="41" y="12" width="18" height="76" rx="9" stroke="url(#tellme-logo-grad)" strokeWidth={strokeWidth} transform="rotate(288 50 50)" />
    </svg>
  )
}
