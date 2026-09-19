import { useEffect, useState } from 'react'

export type Route =
  | { name: 'cartera' }
  | { name: 'empresa'; id: string }
  | { name: 'modelo' }
  | { name: 'benchmarks'; companyId: string | null }
  | { name: 'simulador'; companyId: string | null }
  | { name: 'no-encontrada' }

/** Rutas por hash: `#/`, `#/empresa/emp-0001`, `#/modelo`, `#/benchmarks/emp-0001`, `#/simulador/emp-0001`. */
export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '')
  const [, first, second] = path.split('/')
  switch (first) {
    case undefined:
    case '':
      return { name: 'cartera' }
    case 'empresa':
      return second ? { name: 'empresa', id: decodeURIComponent(second) } : { name: 'no-encontrada' }
    case 'modelo':
      return { name: 'modelo' }
    case 'benchmarks':
      return { name: 'benchmarks', companyId: second ? decodeURIComponent(second) : null }
    case 'simulador':
      return { name: 'simulador', companyId: second ? decodeURIComponent(second) : null }
    default:
      return { name: 'no-encontrada' }
  }
}

export const paths = {
  cartera: '#/',
  empresa: (id: string) => `#/empresa/${encodeURIComponent(id)}`,
  modelo: '#/modelo',
  benchmarks: (companyId?: string) => (companyId ? `#/benchmarks/${encodeURIComponent(companyId)}` : '#/benchmarks'),
  simulador: (companyId?: string) => (companyId ? `#/simulador/${encodeURIComponent(companyId)}` : '#/simulador'),
}

export function useRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash)

  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return parseHash(hash)
}
