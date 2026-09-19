import { useMemo } from 'react'
import { api } from '../api'
import { paths } from '../app/route'
import { ErrorNotice } from '../shared/ErrorNotice'
import { formatDecimal, formatEuros } from '../shared/format'
import { useAsync } from '../shared/useAsync'
import type { ProfilePoint } from './chartTheme'
import { DpdChart } from './DpdChart'
import { LiquidityChart } from './LiquidityChart'
import { ProfileHeader } from './ProfileHeader'
import { ProfileSkeleton } from './ProfileSkeleton'
import { ScoreChart } from './ScoreChart'
import { ScoreSummary } from './ScoreSummary'
import './company-profile.css'

export function CompanyProfileView({ companyId }: { companyId: string }) {
  const profile = useAsync(
    () =>
      Promise.all([
        api.getCompany(companyId),
        api.getScoreHistory(companyId),
        api.getExplanation(companyId),
        api.getKpis(companyId),
        api.getModelInfo(),
      ]),
    [companyId],
  )

  const points = useMemo<ProfilePoint[]>(() => {
    if (!profile.data) return []
    const [, history, , kpis] = profile.data
    return history.flatMap((score, i) => {
      const kpi = kpis[i]
      return kpi ? [{ month: kpi.month, score: score.score, dpd: kpi.dpdMean, liquidity: kpi.liquidityBalance }] : []
    })
  }, [profile.data])

  if (profile.status === 'error') {
    return (
      <div className="stack">
        <a className="back-link t-small" href={paths.cartera}>
          Volver a la cartera
        </a>
        <ErrorNotice title="No se ha podido abrir la ficha de esta empresa." error={profile.error} onRetry={profile.reload} />
      </div>
    )
  }

  if (!profile.data) return <ProfileSkeleton />

  const [company, history, explanation, , model] = profile.data
  const current = history[history.length - 1]
  const firstPoint = points[0]
  const lastPoint = points[points.length - 1]
  const threeMonthsAgo = points[points.length - 4]
  if (!current || !firstPoint || !lastPoint || !threeMonthsAgo) {
    return <ErrorNotice title="Esta empresa aún no tiene histórico suficiente." error={new Error('Sin histórico')} />
  }

  return (
    <div className="profile" aria-busy={profile.status === 'loading'}>
      <ProfileHeader company={company} />
      <ScoreSummary score={current} explanation={explanation} model={model} />

      <div className="panel charts">
        <section className="charts__main" aria-labelledby="chart-score">
          <div className="chart-head">
            <h2 id="chart-score" className="t-h2">
              Evolución del score en 24 meses
            </h2>
            <p className="t-small muted">{`De ${firstPoint.score} a ${lastPoint.score} puntos`}</p>
          </div>
          <ScoreChart data={points} />
        </section>

        <div className="charts__pair">
          <section className="charts__cell" aria-labelledby="chart-dpd">
            <div className="chart-head">
              <h2 id="chart-dpd" className="t-h2">
                Retraso medio de pago
              </h2>
              <p className="t-small muted">{`${formatDecimal(threeMonthsAgo.dpd)} días hace tres meses, ${formatDecimal(lastPoint.dpd)} ahora`}</p>
            </div>
            <DpdChart data={points} />
          </section>

          <section className="charts__cell" aria-labelledby="chart-liquidity">
            <div className="chart-head">
              <h2 id="chart-liquidity" className="t-h2">
                Saldo de liquidez
              </h2>
              <p className="t-small muted">{`${formatEuros(threeMonthsAgo.liquidity)} hace tres meses, ${formatEuros(lastPoint.liquidity)} ahora`}</p>
            </div>
            <LiquidityChart data={points} />
          </section>
        </div>
      </div>
    </div>
  )
}
