import { useMemo, useState } from 'react'
import type { PortfolioRow } from '../api/types'
import { BandBadge } from '../shared/BandBadge'
import { Delta } from '../shared/Delta'
import { Empty } from '../shared/States'
import './portfolio.css'

type Filtro = 'todas' | 'up' | 'down' | 'holdout'

const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'up', label: 'Mejorando' },
  { id: 'down', label: 'Torciéndose' },
  { id: 'holdout', label: 'Test oculto' },
]

export function PortfolioTable({
  rows, onSelect,
}: { rows: PortfolioRow[]; onSelect: (id: string) => void }) {
  const [filtro, setFiltro] = useState<Filtro>('todas')

  const visibles = useMemo(() => {
    const f = filtro === 'todas' ? rows
      : filtro === 'holdout' ? rows.filter((r) => r.heldOut)
      : rows.filter((r) => r.trend === filtro)
    // Primero lo que mas se ha movido, en cualquiera de las dos direcciones.
    return [...f].sort((a, b) => Math.abs(b.delta3m) - Math.abs(a.delta3m)).slice(0, 150)
  }, [rows, filtro])

  return (
    <>
      <div className="filters">
        {FILTROS.map((f) => (
          <button
            key={f.id} type="button"
            className={filtro === f.id ? 'chip chip-on' : 'chip'}
            onClick={() => setFiltro(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <Empty message="Ninguna empresa cumple ese filtro." />
      ) : (
        <table className="portfolio">
          <thead>
            <tr>
              <th>Empresa</th><th>Score</th><th>Nivel</th>
              <th>3 meses</th><th>Señal dominante</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((r) => (
              <tr
                key={r.companyId}
                // Sana pero cayendo: el caso que el reto quiere que se vea.
                className={r.band === 'healthy' && r.trend === 'down' ? 'row-watch' : undefined}
                onClick={() => onSelect(r.companyId)}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') onSelect(r.companyId) }}
              >
                <td>
                  {r.name}
                  {r.heldOut && (
                    <span className="holdout-dot" title="No vista en entrenamiento" />
                  )}
                </td>
                <td className="num">{r.score}</td>
                <td><BandBadge band={r.band} trend={r.trend} /></td>
                <td className="num"><Delta value={r.delta3m} /></td>
                <td className="muted">{r.topDriver}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
