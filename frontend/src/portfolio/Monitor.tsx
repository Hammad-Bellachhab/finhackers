import { getAlerts } from '../api'
import { useAsync } from '../shared/useAsync'
import { Delta } from '../shared/Delta'
import { Empty, ErrorNotice, Skeleton } from '../shared/States'
import './portfolio.css'

/** El sistema levanta la mano solo: no espera a que nadie pregunte. */
export function Monitor({ onSelect }: { onSelect: (id: string) => void }) {
  const { data, error, loading } = useAsync(() => getAlerts(), [])

  if (loading) return <Skeleton height="9rem" />
  if (error) return <ErrorNotice error={error} />
  if (!data || data.length === 0) {
    return <Empty message="Ninguna empresa se ha movido lo suficiente." />
  }

  return (
    <div className="monitor">
      {data.slice(0, 8).map((a) => (
        <div
          key={a.id} className={`alert alert-${a.kind}`} onClick={() => onSelect(a.companyId)}
          role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') onSelect(a.companyId) }}
        >
          <strong>{a.companyName}</strong>
          <Delta value={a.delta} />
          <span className="muted">{a.message}</span>
          {a.monthsAhead !== null && (
            <span className="ahead">visto {a.monthsAhead} meses antes</span>
          )}
        </div>
      ))}
    </div>
  )
}
