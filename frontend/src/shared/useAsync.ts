import { useEffect, useState } from 'react'

type State<T> = { data: T | null; error: Error | null; loading: boolean }

/** Carga asincrona con los tres estados. Ignora respuestas de peticiones
 *  obsoletas para que cambiar de empresa rapido no pinte datos cruzados. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): State<T> {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true })

  useEffect(() => {
    let vigente = true
    setState({ data: null, error: null, loading: true })
    fn()
      .then((data) => { if (vigente) setState({ data, error: null, loading: false }) })
      .catch((e: unknown) => {
        if (vigente) {
          setState({
            data: null,
            error: e instanceof Error ? e : new Error(String(e)),
            loading: false,
          })
        }
      })
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}
