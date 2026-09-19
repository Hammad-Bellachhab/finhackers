import { useCallback, useEffect, useRef, useState } from 'react'

export type AsyncState<T> =
  | { status: 'loading'; data: T | null; error: null }
  | { status: 'ready'; data: T; error: null }
  | { status: 'error'; data: T | null; error: Error }

/**
 * Carga datos de la capa `api`. Mientras recarga conserva el dato anterior, así la
 * interfaz puede atenuarlo en vez de vaciarlo. Descarta respuestas de peticiones antiguas.
 */
export function useAsync<T>(load: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading', data: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    let cancelled = false
    setState((previous) => ({ status: 'loading', data: previous.data, error: null }))
    loadRef.current().then(
      (data) => {
        if (!cancelled) setState({ status: 'ready', data, error: null })
      },
      (error: unknown) => {
        if (!cancelled) {
          setState((previous) => ({
            status: 'error',
            data: previous.data,
            error: error instanceof Error ? error : new Error(String(error)),
          }))
        }
      },
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  return { ...state, reload }
}
