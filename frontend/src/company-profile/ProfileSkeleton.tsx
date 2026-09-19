import { paths } from '../app/route'

/** Misma estructura que la ficha real: cabecera, bloque de score y panel de gráficos. */
export function ProfileSkeleton() {
  return (
    <div className="profile" aria-busy="true" aria-label="Cargando la ficha de la empresa">
      <header className="profile-head">
        <a className="back-link t-small" href={paths.cartera}>
          Volver a la cartera
        </a>
        <span className="skeleton profile-skeleton__name" />
        <span className="skeleton profile-skeleton__meta" />
      </header>
      <div className="score-summary" aria-hidden="true">
        <div className="score-summary__score">
          <span className="skeleton profile-skeleton__score" />
          <span className="skeleton profile-skeleton__meta" />
        </div>
        <div className="score-summary__why">
          <span className="skeleton profile-skeleton__line" />
          <span className="skeleton profile-skeleton__line profile-skeleton__line--short" />
        </div>
      </div>
      <div className="panel charts" aria-hidden="true">
        <div className="charts__main">
          <span className="skeleton profile-skeleton__chart-main" />
        </div>
        <div className="charts__pair">
          <div className="charts__cell">
            <span className="skeleton profile-skeleton__chart-small" />
          </div>
          <div className="charts__cell">
            <span className="skeleton profile-skeleton__chart-small" />
          </div>
        </div>
      </div>
    </div>
  )
}
