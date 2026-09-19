import { useCallback } from 'react'
import { api, type PortfolioSortKey } from '../api'
import { paths } from '../app/route'
import { ErrorNotice } from '../shared/ErrorNotice'
import { formatDate, formatInt } from '../shared/format'
import { useDebounced, usePersistentState } from '../shared/hooks'
import { useAsync } from '../shared/useAsync'
import { DEFAULT_FILTERS, hasActiveFilters, isPortfolioFilters, type PortfolioFilters } from './filters'
import { PortfolioFilterBar } from './PortfolioFilterBar'
import { PortfolioSummary } from './PortfolioSummary'
import { PortfolioTable } from './PortfolioTable'
import './portfolio.css'

/** Columnas de texto arrancan de la A a la Z; las numéricas, de mayor a menor. */
function defaultDirection(key: PortfolioSortKey): 'asc' | 'desc' {
  return key === 'name' || key === 'sector' ? 'asc' : 'desc'
}

export function PortfolioView() {
  const [filters, setFilters] = usePersistentState<PortfolioFilters>('embat-portfolio-filters', DEFAULT_FILTERS, isPortfolioFilters)
  const query = useDebounced(filters.query, 250)

  const list = useAsync(
    () =>
      api.listCompanies({
        query,
        riskBand: filters.riskBand || undefined,
        sector: filters.sector || undefined,
        groupId: filters.groupId || undefined,
        risingFast: filters.risingFast,
        sortBy: filters.sortBy,
        sortDir: filters.sortDir,
        page: filters.page,
      }),
    [query, filters.riskBand, filters.sector, filters.groupId, filters.risingFast, filters.sortBy, filters.sortDir, filters.page],
  )
  const summary = useAsync(() => api.getPortfolioSummary(), [])
  const options = useAsync(() => api.getFilterOptions(), [])

  const patch = useCallback(
    (change: Partial<PortfolioFilters>) => setFilters((previous) => ({ ...previous, page: 1, ...change })),
    [setFilters],
  )

  const sortBy = (key: PortfolioSortKey) =>
    setFilters((previous) =>
      previous.sortBy === key
        ? { ...previous, page: 1, sortDir: previous.sortDir === 'asc' ? 'desc' : 'asc' }
        : { ...previous, page: 1, sortBy: key, sortDir: defaultDirection(key) },
    )

  const page = list.data
  const busy = list.status === 'loading'
  const from = page && page.total > 0 ? (page.page - 1) * page.pageSize + 1 : 0
  const to = page ? Math.min(page.page * page.pageSize, page.total) : 0
  const filtered = hasActiveFilters(filters)

  return (
    <div className="portfolio">
      <header className="view-head">
        <h1 className="t-h1">Cartera</h1>
        <p className="muted">
          {summary.data
            ? `${formatInt(summary.data.totalCompanies)} empresas con datos al ${formatDate(summary.data.asOf)}. Las que más suben aparecen marcadas en rojo.`
            : 'Cargando la cartera'}
        </p>
      </header>

      <PortfolioSummary
        summary={summary.data}
        filters={filters}
        onToggleRisingFast={() => patch({ risingFast: !filters.risingFast, sortBy: 'delta', sortDir: 'desc' })}
        onToggleHighRisk={() => patch({ riskBand: filters.riskBand === 'alto' ? '' : 'alto' })}
      />

      <PortfolioFilterBar
        filters={filters}
        options={options.data}
        onChange={patch}
        onClear={() => setFilters({ ...DEFAULT_FILTERS })}
      />

      {list.status === 'error' && !page ? (
        <ErrorNotice title="No se han podido cargar las empresas." error={list.error} onRetry={list.reload} />
      ) : (
        <section className="panel portfolio__panel" aria-label="Tabla de empresas">
          <PortfolioTable
            rows={page ? page.items : null}
            sortBy={filters.sortBy}
            sortDir={filters.sortDir}
            busy={busy}
            onSort={sortBy}
            onOpen={(id) => {
              window.location.hash = paths.empresa(id)
            }}
          />

          {page && page.total === 0 ? (
            <div className="empty">
              <p className="empty__title">No hay empresas que coincidan con estos filtros.</p>
              <p className="muted">Prueba a quitar uno, o busca solo por una parte del nombre.</p>
              {filtered ? (
                <button type="button" className="btn" onClick={() => setFilters({ ...DEFAULT_FILTERS })}>
                  Quitar todos los filtros
                </button>
              ) : null}
            </div>
          ) : null}

          {page && page.total > 0 ? (
            <nav className="pager" aria-label="Paginación de la cartera">
              <p className="t-small muted" aria-live="polite">
                {`Empresas ${formatInt(from)} a ${formatInt(to)} de ${formatInt(page.total)}`}
              </p>
              <div className="pager__controls">
                <button type="button" className="btn" disabled={page.page <= 1} onClick={() => setFilters((p) => ({ ...p, page: page.page - 1 }))}>
                  Página anterior
                </button>
                <span className="t-mono-sm">{`${page.page} / ${page.pageCount}`}</span>
                <button
                  type="button"
                  className="btn"
                  disabled={page.page >= page.pageCount}
                  onClick={() => setFilters((p) => ({ ...p, page: page.page + 1 }))}
                >
                  Página siguiente
                </button>
              </div>
            </nav>
          ) : null}

          {list.status === 'error' && page ? (
            <div className="pager">
              <ErrorNotice title="La lista no se ha podido actualizar." error={list.error} onRetry={list.reload} />
            </div>
          ) : null}
        </section>
      )}
    </div>
  )
}
