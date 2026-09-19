import { useState } from 'react'
import { getCompanyScore, getDecisions, getForecast, getPortfolio } from '../api'
import { useAsync } from '../shared/useAsync'
import { ErrorNotice, Skeleton } from '../shared/States'
import { DecisionsSection } from './DecisionsSection'
import { ForecastSection } from './ForecastSection'
import { ProfileSections } from './ProfileSections'
import { PulseSection } from './PulseSection'

/** Buscador nativo (datalist): nombre o ID, sin librerías. */
function CompanyPicker({ onSelect }: { onSelect: (id: string) => void }) {
  const { data } = useAsync(() => getPortfolio(), [])
  const [q, setQ] = useState('')
  const rows = data?.rows ?? []
  const pick = (v: string) => {
    setQ(v)
    const hit = rows.find((r) => r.companyId === v || `${r.name} · ${r.companyId}` === v)
    if (hit) { onSelect(hit.companyId); setQ('') }
  }
  return (
    <div className="company-picker">
      <label htmlFor="company-search" className="muted">Empresa</label>
      <input
        id="company-search" list="company-list" value={q} placeholder="Busca por nombre o ID…"
        onChange={(e) => pick(e.target.value)}
      />
      <datalist id="company-list">
        {rows.map((r) => <option key={r.companyId} value={`${r.name} · ${r.companyId}`} />)}
      </datalist>
    </div>
  )
}

export function CompanyView({ companyId, onSelect }: { companyId: string; onSelect: (id: string) => void }) {
  const score = useAsync(() => getCompanyScore(companyId), [companyId])
  const forecast = useAsync(() => getForecast(companyId), [companyId])
  const decisions = useAsync(() => getDecisions(companyId), [companyId])

  return (
    <>
      <CompanyPicker onSelect={onSelect} />
      {score.loading && <Skeleton height="22rem" />}
      {score.error && <ErrorNotice error={score.error} />}
      {score.data && (
        <>
          <PulseSection score={score.data} />
          <ProfileSections companyId={companyId} />
          {forecast.loading && <Skeleton />}
          {forecast.error && <ErrorNotice error={forecast.error} />}
          {forecast.data && <ForecastSection score={score.data} forecast={forecast.data} />}
          {decisions.loading && <Skeleton height="8rem" />}
          {decisions.error && <ErrorNotice error={decisions.error} />}
          {decisions.data && (
            <DecisionsSection
              companyId={companyId} decisions={decisions.data} metrics={score.data.metrics}
            />
          )}
        </>
      )}
    </>
  )
}
