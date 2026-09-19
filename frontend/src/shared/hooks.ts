import { useCallback, useEffect, useState } from 'react'

export function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}

/** Estado que sobrevive a la navegación entre vistas (sessionStorage). */
export function usePersistentState<T>(
  key: string,
  initial: T,
  isValid: (value: unknown) => value is T,
): [T, (update: T | ((previous: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key)
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw)
        if (isValid(parsed)) return parsed
      }
    } catch {
      // sin sessionStorage o JSON corrupto: se usa el valor inicial
    }
    return initial
  })

  const update = useCallback(
    (next: T | ((previous: T) => T)) => {
      setState((previous) => {
        const value = typeof next === 'function' ? (next as (p: T) => T)(previous) : next
        try {
          sessionStorage.setItem(key, JSON.stringify(value))
        } catch {
          // el estado sigue vivo aunque no se pueda guardar
        }
        return value
      })
    },
    [key],
  )

  return [state, update]
}
