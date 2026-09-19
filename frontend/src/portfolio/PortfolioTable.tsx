import { RISING_FAST_DELTA, type PortfolioRow, type PortfolioSortKey } from '../api'
import { paths } from '../app/route'
import { BandBadge } from '../shared/BandBadge'
import { Delta } from '../shared/Delta'
import { formatDate } from '../shared/format'

interface Column {
  key: PortfolioSortKey | null
  label: string
  numeric: boolean
}

const COLUMNS: readonly Column[] = [
  { key: 'name', label: 'Empresa', numeric: false },
  { key: 'sector', label: 'Sector', numeric: false },
  { key: 'score', label: 'Score', numeric: true },
  { key: 'percentile', label: 'Percentil', numeric: true },
  { key: 'delta', label: 'Cambio en el mes', numeric: true },
  { key: null, label: 'Banda de riesgo', numeric: false },
  { key: 'date', label: 'Actualizada', numeric: true },
]

interface PortfolioTableProps {
  rows: PortfolioRow[] | null
  sortBy: PortfolioSortKey
  sortDir: 'asc' | 'desc'
  busy: boolean
  onSort: (key: PortfolioSortKey) => void
  onOpen: (companyId: string) => void
}

const SKELETON_ROWS = 12

export function PortfolioTable({ rows, sortBy, sortDir, busy, onSort, onOpen }: PortfolioTableProps) {
  return (
    <div className="table-wrap" aria-busy={busy}>
      <table className="portfolio-table">
        <caption className="visually-hidden">Empresas de la cartera ordenadas por la columna seleccionada</caption>
        <thead>
          <tr>
            {COLUMNS.map((column) => {
              const active = column.key !== null && column.key === sortBy
              return (
                <th
                  key={column.label}
                  scope="col"
                  className={column.numeric ? 'is-numeric' : undefined}
                  aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : column.key ? 'none' : undefined}
                >
                  {column.key ? (
                    <button type="button" className="th-sort" onClick={() => onSort(column.key as PortfolioSortKey)}>
                      {column.label}
                      <svg
                        className={`th-sort__icon${active ? ' is-active' : ''}${active && sortDir === 'asc' ? ' is-asc' : ''}`}
                        viewBox="0 0 8 5"
                        width="8"
                        height="5"
                        aria-hidden="true"
                      >
                        <path d="M1 1l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className={busy && rows ? 'is-stale' : undefined}>
          {rows
            ? rows.map((row) => {
                const rising = row.score.deltaVsPrevMonth >= RISING_FAST_DELTA
                return (
                  <tr
                    key={row.company.id}
                    className={`portfolio-row${rising ? ' is-rising' : ''}`}
                    onClick={() => onOpen(row.company.id)}
                  >
                    <th scope="row" className="cell-company">
                      <a href={paths.empresa(row.company.id)} className="company-name" onClick={(event) => event.stopPropagation()}>
                        {row.company.name}
                      </a>
                    </th>
                    <td className="cell-sector">{row.company.sector}</td>
                    <td className="is-numeric t-mono-sm cell-level">{row.score.score}</td>
                    <td className="is-numeric t-mono-sm cell-level">{row.score.percentile}</td>
                    <td className={`is-numeric cell-delta${rising ? ' is-rising' : ''}`}>
                      <Delta value={row.score.deltaVsPrevMonth} />
                    </td>
                    <td>
                      <BandBadge band={row.score.band} />
                    </td>
                    <td className="is-numeric t-mono-sm cell-level">{formatDate(row.score.date)}</td>
                  </tr>
                )
              })
            : Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <tr key={i} aria-hidden="true">
                  <td>
                    <span className="skeleton" style={{ width: `${55 + ((i * 17) % 35)}%` }} />
                  </td>
                  <td>
                    <span className="skeleton" style={{ width: `${45 + ((i * 23) % 40)}%` }} />
                  </td>
                  {[0, 1, 2].map((n) => (
                    <td key={n} className="is-numeric">
                      <span className="skeleton skeleton--short" />
                    </td>
                  ))}
                  <td>
                    <span className="skeleton skeleton--short" />
                  </td>
                  <td className="is-numeric">
                    <span className="skeleton skeleton--short" />
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  )
}
