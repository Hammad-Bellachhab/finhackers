import type { FilterOptions, RiskBand } from '../api'
import { hasActiveFilters, type PortfolioFilters } from './filters'

interface PortfolioFilterBarProps {
  filters: PortfolioFilters
  options: FilterOptions | null
  onChange: (patch: Partial<PortfolioFilters>) => void
  onClear: () => void
}

export function PortfolioFilterBar({ filters, options, onChange, onClear }: PortfolioFilterBarProps) {
  return (
    <form className="filters" role="search" aria-label="Filtrar la cartera" onSubmit={(event) => event.preventDefault()}>
      <label className="field field--search">
        <span className="t-small muted">Buscar empresa</span>
        <input
          type="search"
          className="input"
          placeholder="Nombre de la empresa"
          value={filters.query}
          onChange={(event) => onChange({ query: event.target.value })}
        />
      </label>

      <label className="field">
        <span className="t-small muted">Banda de riesgo</span>
        <select
          className="input"
          value={filters.riskBand}
          onChange={(event) => onChange({ riskBand: event.target.value as RiskBand | '' })}
        >
          <option value="">Todas</option>
          <option value="alto">Alto</option>
          <option value="medio">Medio</option>
          <option value="bajo">Bajo</option>
        </select>
      </label>

      <label className="field">
        <span className="t-small muted">Sector</span>
        <select className="input" value={filters.sector} onChange={(event) => onChange({ sector: event.target.value })}>
          <option value="">Todos</option>
          {options?.sectors.map((sector) => (
            <option key={sector} value={sector}>
              {sector}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="t-small muted">Grupo</span>
        <select className="input" value={filters.groupId} onChange={(event) => onChange({ groupId: event.target.value })}>
          <option value="">Todos</option>
          {options?.groups.map((group) => (
            <option key={group.id} value={group.id}>
              {`${group.name} (${group.size})`}
            </option>
          ))}
        </select>
      </label>

      <div className="filters__reset">
        <button type="button" className="btn" onClick={onClear} disabled={!hasActiveFilters(filters)}>
          Quitar filtros
        </button>
      </div>
    </form>
  )
}
