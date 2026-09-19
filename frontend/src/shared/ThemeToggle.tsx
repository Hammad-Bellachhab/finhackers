import { useState } from 'react'
import { applyTheme, type Theme } from './theme'

/** Iconos en SVG y no en glifos (☀/☾): los glifos cambian de forma y de tamaño
 *  en cada sistema operativo y no se alinean con el resto de la barra. */
function Sun() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6" />
    </svg>
  )
}

function Moon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.2 8.2 0 1 0 10.2 10.2z" />
    </svg>
  )
}

/** Botón de claro/oscuro. El tema vive en el <html>, así que sirve igual en la app y en las landings. */
export function ThemeToggle({ className = 'theme-toggle' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme as Theme) ?? 'light')
  const esOscuro = theme === 'dark'

  const alternar = () => {
    const siguiente: Theme = esOscuro ? 'light' : 'dark'
    setTheme(siguiente)
    applyTheme(siguiente)
  }

  return (
    <button
      type="button" className={className} onClick={alternar}
      aria-label={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={esOscuro ? 'Modo claro' : 'Modo oscuro'}
    >
      {esOscuro ? <Sun /> : <Moon />}
    </button>
  )
}
