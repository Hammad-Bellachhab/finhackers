import { RISING_FAST_DELTA, type PortfolioSummary as Summary } from '../api'
import { formatInt, formatSigned } from '../shared/format'
import type { PortfolioFilters } from './filters'

interface PortfolioSummaryProps {
  summary: Summary | null
  filters: PortfolioFilters
  onToggleRisingFast: () => void
  onToggleHighRisk: () => void
}

/** Responde "¿de qué me preocupo hoy?" antes de leer la tabla. Los dos primeros datos son atajos de filtro. */
export function PortfolioSummary({ summary, filters, onToggleRisingFast, onToggleHighRisk }: PortfolioSummaryProps) {
  if (!summary) {
    return (
      <div className="summary" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="summary__item">
            <span className="skeleton summary__skeleton-figure" />
            <span className="skeleton summary__skeleton-label" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="summary">
      <button
        type="button"
        className="summary__item summary__item--action"
        aria-pressed={filters.risingFast}
        onClick={onToggleRisingFast}
      >
        <span className="summary__figure t-mono">{formatInt(summary.risingFast)}</span>
        <span className="summary__label">
          suben rápido este mes
          <span className="summary__hint muted t-small">{`${RISING_FAST_DELTA} puntos o más`}</span>
        </span>
      </button>
      <button
        type="button"
        className="summary__item summary__item--plain"
        aria-pressed={filters.riskBand === 'alto'}
        onClick={onToggleHighRisk}
      >
        <span className="summary__figure t-mono">{formatInt(summary.byBand.alto)}</span>
        <span className="summary__label">
          en riesgo alto
          <span className="summary__hint muted t-small">{`de ${formatInt(summary.totalCompanies)} empresas`}</span>
        </span>
      </button>
      <div className="summary__item summary__item--static">
        <span className="summary__figure t-mono">{formatSigned(summary.meanDelta, 1)}</span>
        <span className="summary__label">
          variación media del score
          <span className="summary__hint muted t-small">frente al mes anterior</span>
        </span>
      </div>
    </div>
  )
}
