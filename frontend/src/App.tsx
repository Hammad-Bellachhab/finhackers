import { useEffect, useState } from 'react'
import './App.css'
import { PaletteSheet } from './styles/PaletteSheet'

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
    <div className="shell">
      <header className="topbar">
        <span className="mark" aria-hidden="true" />
        <strong>finhackers</strong>
        <span className="topbar-sep">·</span>
        <span className="topbar-sub">Reto X-Ray de Embat</span>
        <span className="spacer" />
        <span className={`pill ${error ? 'pill-danger' : health ? 'pill-ok' : ''}`}>
          {error ? `API caida (${error})` : health ? `API ${health.status} v${health.version}` : 'conectando…'}
        </span>
      </header>

      <main>
        <PaletteSheet />
      </main>
    </div>
  )
}
