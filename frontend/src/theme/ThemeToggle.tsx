import { THEME_LABELS, type ThemeId } from './useTheme'
import './theme-toggle.css'

const ORDER: ThemeId[] = ['claro', 'oscuro']

interface ThemeToggleProps {
  theme: ThemeId
  onChange: (theme: ThemeId) => void
}

export function ThemeToggle({ theme, onChange }: ThemeToggleProps) {
  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Tema de la interfaz">
      {ORDER.map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={theme === id}
          className="theme-toggle__option"
          onClick={() => onChange(id)}
        >
          {THEME_LABELS[id]}
        </button>
      ))}
    </div>
  )
}
