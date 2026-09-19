import type { CompanyDetail } from '../api'
import { paths } from '../app/route'
import { countryName } from '../shared/format'

export function ProfileHeader({ company }: { company: CompanyDetail }) {
  const groupNote = company.groupSize > 1 ? `${company.groupName}, ${company.groupSize} empresas` : `${company.groupName}, sin filiales`
  return (
    <header className="profile-head">
      <a className="back-link t-small" href={paths.cartera}>
        Volver a la cartera
      </a>
      <h1 className="t-h1 profile-head__name">{company.name}</h1>
      <dl className="profile-head__meta">
        <div>
          <dt className="t-small muted">Sector</dt>
          <dd className="t-small">{company.sector}</dd>
        </div>
        <div>
          <dt className="t-small muted">Grupo</dt>
          <dd className="t-small">{groupNote}</dd>
        </div>
        <div>
          <dt className="t-small muted">País</dt>
          <dd className="t-small">{countryName(company.country)}</dd>
        </div>
        <div>
          <dt className="t-small muted">Tamaño</dt>
          <dd className="t-small">{company.size}</dd>
        </div>
      </dl>
    </header>
  )
}
