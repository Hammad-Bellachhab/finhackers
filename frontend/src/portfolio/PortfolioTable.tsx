import { Fragment, useMemo, useState } from 'react'
import type { PortfolioRow } from '../api/types'
import { BandBadge } from '../shared/BandBadge'
import { Delta } from '../shared/Delta'
import { Pill } from '../shared/Pill'
import { Empty } from '../shared/States'
import { TellMeLogo } from '../shared/TellMeLogo'
import { TellMeCard } from '../shared/TellMeCard'
import './portfolio.css'

type Filtro = 'todas' | 'up' | 'down'
type Orden = 'movimiento' | 'caida' | 'mejora' | 'peor' | 'mejor'

const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'up', label: 'Mejorando' },
  { id: 'down', label: 'Torciéndose' },
]

const ORDEN: Record<Orden, [string, (a: PortfolioRow, b: PortfolioRow) => number]> = {
  movimiento: ['Más movimiento en 3 m', (a, b) => Math.abs(b.delta3m) - Math.abs(a.delta3m)],
  caida: ['Mayor caída en 3 m (urgencia)', (a, b) => a.delta3m - b.delta3m],
  mejora: ['Mayor mejora en 3 m', (a, b) => b.delta3m - a.delta3m],
  peor: ['Menor salud', (a, b) => a.score - b.score],
  mejor: ['Mayor salud', (a, b) => b.score - a.score],
}

const LIMITE = 300

export function PortfolioTable({
  rows, onSelect,
}: { rows: PortfolioRow[]; onSelect: (id: string) => void }) {
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [banda, setBanda] = useState('')
  const [cohorte, setCohorte] = useState('')
  const [orden, setOrden] = useState<Orden>('movimiento')
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggleExpand = (companyId: string) => {
    setExpanded((prev) => ({ ...prev, [companyId]: !prev[companyId] }))
  }

  const detalle = rows.some((r) => r.healthBand)

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase()
    return rows
      .filter((r) => filtro === 'todas' || r.trend === filtro)
      .filter((r) => !banda || r.healthBand === banda)
      .filter((r) => !cohorte || r.sizeCohort === cohorte)
      .filter((r) => !t || [r.name, r.companyId, r.group].some((s) => s?.toLowerCase().includes(t)))
      .sort(ORDEN[orden][1])
  }, [rows, filtro, banda, cohorte, orden, q])
  const visibles = filtradas.slice(0, LIMITE)

  return (
    <>
      <div className="filters">
        {FILTROS.map((f) => (
          <button
            key={f.id} type="button"
            className={filtro === f.id ? 'chip chip-on' : 'chip'}
            aria-pressed={filtro === f.id}
            onClick={() => setFiltro(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {detalle && (
        <div className="filters filters-form">
          <select aria-label="Banda de salud" value={banda} onChange={(e) => setBanda(e.target.value)}>
            <option value="">Todas las bandas</option>
            {['riesgo', 'vigilar', 'sana', 'sólida'].map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select aria-label="Cohorte de tamaño" value={cohorte} onChange={(e) => setCohorte(e.target.value)}>
            <option value="">Todos los tamaños</option>
            {['q1', 'q2', 'q3', 'q4'].map((c) => <option key={c} value={c}>tamaño {c}{c === 'q4' ? ' (mayores)' : ''}</option>)}
          </select>
          <select aria-label="Ordenar por" value={orden} onChange={(e) => setOrden(e.target.value as Orden)}>
            {Object.entries(ORDEN).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <input type="search" aria-label="Buscar empresa o grupo" placeholder="Buscar empresa o grupo…" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="muted">{filtradas.length.toLocaleString('es-ES')} empresas{filtradas.length > LIMITE && ` · se muestran ${LIMITE}`}</span>
        </div>
      )}

      {visibles.length === 0 ? (
        <Empty message="Ninguna empresa cumple ese filtro." />
      ) : (
        <div className="table-scroll">
          <table className="portfolio">
            <thead>
              <tr>
                <th>Empresa</th><th>Score</th><th>Nivel</th>
                <th>3 meses</th>
                {detalle && <><th>1 mes</th><th>Señal</th><th>P(deterioro 6 m)</th><th>Grupo</th><th>Tamaño</th></>}
                <th>Señal dominante</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((r) => {
                const isExpanded = !!expanded[r.companyId]
                return (
                  <Fragment key={r.companyId}>
                  <tr
                    // Sana pero cayendo: el caso que el reto quiere que se vea.
                    className={r.band === 'healthy' && r.trend === 'down' ? 'row-watch' : undefined}
                    onClick={() => onSelect(r.companyId)}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') onSelect(r.companyId) }}
                  >
                    <td>
                      <button
                        type="button"
                        className={`btn-expand-tellme ${isExpanded ? 'expanded' : ''}`}
                        title={isExpanded ? 'Cerrar análisis de TellMe' : 'Ver análisis de TellMe'}
                        aria-label={`${isExpanded ? 'Cerrar' : 'Ver'} el análisis de TellMe de ${r.name}`}
                        aria-expanded={isExpanded}
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleExpand(r.companyId)
                        }}
                        // Sin esto, Enter en el botón también abre la ficha (lo recoge la fila).
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <TellMeLogo size={14} />
                      </button>
                      {r.name}
                      {r.heldOut && (
                        <span className="holdout-dot" role="img" aria-label="No vista en entrenamiento" title="No vista en entrenamiento" />
                      )}
                    </td>
                    <td className="num">{r.score}</td>
                    <td><BandBadge band={r.band} trend={r.trend} /></td>
                    <td className="num"><Delta value={r.delta3m} /></td>
                    {detalle && (
                      <>
                        <td className="num"><Delta value={r.delta1m ?? 0} /></td>
                        <td><Pill text={r.signal ?? ''} /></td>
                        <td className="num">{r.pDeterioration == null ? '—' : `${(100 * r.pDeterioration).toFixed(0)} %`}</td>
                        <td className="muted">{r.group}</td>
                        <td className="muted">{r.sizeCohort}</td>
                      </>
                    )}
                    <td className="muted">{r.topDriver}</td>
                  </tr>
                  {isExpanded && (
                    <tr className="row-tellme-expansion">
                      <td colSpan={detalle ? 10 : 5}>
                        <div className="portfolio-tellme-card" onClick={(e) => e.stopPropagation()}>
                          <TellMeCard companyId={r.companyId} name={r.name} />
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
