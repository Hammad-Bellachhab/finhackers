import { getCompanyScore, getDecisions, getForecast } from '../api'
import { useAsync } from '../shared/useAsync'
import { ErrorNotice, Skeleton } from '../shared/States'
import { DecisionsSection } from './DecisionsSection'
import { ForecastSection } from './ForecastSection'
import { PulseSection } from './PulseSection'

export function CompanyView({ companyId }: { companyId: string }) {
  const score = useAsync(() => getCompanyScore(companyId), [companyId])
  const forecast = useAsync(() => getForecast(companyId), [companyId])
  const decisions = useAsync(() => getDecisions(companyId), [companyId])

  if (score.loading) return <Skeleton height="22rem" />
  if (score.error) return <ErrorNotice error={score.error} />
  if (!score.data) return null

  return (
    <>
      <PulseSection score={score.data} />
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
  )
}
