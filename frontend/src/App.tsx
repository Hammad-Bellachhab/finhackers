import { useEffect, useState } from 'react'
import './App.css'

type Health = {
  status: string
  service: string
  version: string
}

export default function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<Health>
      })
      .then(setHealth)
      .catch((err: Error) => setError(err.message))
  }, [])

  return (
    <main>
      <h1>finhackers</h1>
      <p className="status">
        Backend:{' '}
        {error ? (
          <span className="ko">sin conexion ({error})</span>
        ) : health ? (
          <span className="ok">
            {health.status} — {health.service} v{health.version}
          </span>
        ) : (
          <span>comprobando…</span>
        )}
      </p>
    </main>
  )
}
