import { useState } from 'react'
import { getAlerts } from '../api'
import { Delta } from '../shared/Delta'
import { Pill } from '../shared/Pill'
import { Empty, ErrorNotice, Skeleton } from '../shared/States'
import { useAsync } from '../shared/useAsync'
import './portfolio.css'

const SEÑALES = [
  'caída estructural', 'caída brusca este mes', 'deterioro incipiente',
  'mejora progresiva', 'excepcionalmente sólida',
]

/** Monitor proactivo completo: qué ha cambiado este mes y merece atención. */
export function AlertsView({ onSelect }: { onSelect: (id: string) => void }) {
  const { data, error, loading } = useAsync(() => getAlerts(), [])
  const [sel, setSel] = useState<string[]>(SEÑALES.slice(0, 4))

  if (loading) return <Skeleton height="26rem" />
  if (error) return <ErrorNotice error={error} />
  if (!data) return null

  const toggle = (s: string) => setSel((v) => (v.includes(s) ? v.filter((x) => x !== s) : [...v, s]))
  const visibles = data.filter((a) => sel.includes(a.signal ?? ''))

  return (
    <>
      <h2>Monitor: se han movido solas este mes</h2>
      <p className="muted legend-line">
        El sistema levanta la mano sin que nadie pregunte. Se recalcula con cada carga de datos. Pulsa una señal para filtrar.
      </p>
      <div className="counts">
        {SEÑALES.map((s) => (
          <button
            key={s} type="button" aria-pressed={sel.includes(s)}
            className={`count count-button ${sel.includes(s) ? 'count-on' : ''}`} onClick={() => toggle(s)}
          >
            <strong>{data.filter((a) => a.signal === s).length}</strong><span>{s}</span>
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <Empty message="Ninguna alerta con esas señales." />
      ) : (
        <div className="table-scroll">
          <table className="portfolio">
            <thead>
              <tr>
                <th>Empresa</th><th>Señal</th><th>Salud</th><th>1 mes</th><th>3 meses</th>
                <th>Visto antes</th><th>Qué ha cambiado</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((a) => (
                <tr
                  key={a.id} onClick={() => onSelect(a.companyId)} tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') onSelect(a.companyId) }}
                >
                  <td>{a.companyName}</td>
                  <td><Pill text={a.signal ?? ''} /></td>
                  <td className="num">{Math.round(a.score)}</td>
                  <td className="num"><Delta value={a.delta1m ?? 0} /></td>
                  <td className="num"><Delta value={a.delta} /></td>
                  <td className="num">{a.monthsAhead == null ? '—' : `${a.monthsAhead} m`}</td>
                  <td className="muted">{a.why || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
