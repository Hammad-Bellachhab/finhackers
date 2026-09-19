import './shared.css'

export type TellMeLogoProps = {
  className?: string
  size?: number
}

/** Logo oficial de TellMe (public/tellme-logo.png, el archivo exacto de la marca) usado como máscara:
 *  la silueta es la original y el relleno lleva el degradado azul → violeta, en claro y en oscuro.
 *  Se anima con CSS (.tellme-logo-svg). */
export function TellMeLogo({ className = '', size = 20 }: TellMeLogoProps) {
  return (
    <span
      className={`tellme-logo-svg tellme-logo ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  )
}

/** "TellMe" con el degradado de la marca. */
export function TellMeWordmark() {
  return <span className="tellme-wordmark">TellMe</span>
}
