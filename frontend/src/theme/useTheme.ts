import { useCallback, useEffect, useState } from 'react'

export type ThemeId = 'claro' | 'oscuro'

export const THEME_STORAGE_KEY = 'embat-theme'

export const THEME_LABELS: Record<ThemeId, string> = {
  claro: 'Índice de tesorería',
  oscuro: 'Terminal Embat',
}

function isThemeId(value: string | null): value is ThemeId {
  return value === 'claro' || value === 'oscuro'
}

function readStoredTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (isThemeId(stored)) return stored
  } catch {
    // localStorage no disponible: se usa el tema por defecto
  }
  return 'claro'
}

export function useTheme(): [ThemeId, (theme: ThemeId) => void] {
  const [theme, setThemeState] = useState<ThemeId>(readStoredTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // la elección sigue vigente durante la sesión aunque no persista
    }
  }, [])

  return [theme, setTheme]
}
