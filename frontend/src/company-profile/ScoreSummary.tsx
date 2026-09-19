import type { ModelInfo, RiskScore, ScoreExplanation } from '../api'
import { BandBadge } from '../shared/BandBadge'
import { Delta } from '../shared/Delta'
import { formatDate, formatDecimal } from '../shared/format'

interface ScoreSummaryProps {
  score: RiskScore
  explanation: ScoreExplanation
  model: ModelInfo
}

export function ScoreSummary({ score, explanation, model }: ScoreSummaryProps) {
  const otherFactors = explanation.topFactors.slice(1, 4)

  return (
    <section className="score-summary" aria-label="Score actual">
      <div className="score-summary__score">
        <p className="score-summary__figure t-display" aria-label={`Score ${score.score} de 100`}>
          {score.score}
        </p>
        <dl className="score-summary__facts">
          <div>
            <dt className="t-small muted">Cambio en el mes</dt>
            <dd>
              <Delta value={score.deltaVsPrevMonth} size="large" noiseBelow={3} />
            </dd>
          </div>
          <div>
            <dt className="t-small muted">Percentil de la cartera</dt>
            <dd className="t-mono">{score.percentile}</dd>
          </div>
          <div>
            <dt className="t-small muted">Banda de riesgo</dt>
            <dd>
              <BandBadge band={score.band} />
            </dd>
          </div>
        </dl>
        <ul className="score-summary__badges" aria-label="Referencias del modelo">
          <li className="ref-badge">{`AUC-PR ${formatDecimal(model.aucPr, 2)}`}</li>
          <li className="ref-badge">{`Modelo ${model.modelVersion}`}</li>
          <li className="ref-badge">{`Datos al ${formatDate(score.date)}`}</li>
        </ul>
      </div>

      <div className="score-summary__why">
        <h2 className="t-small muted score-summary__why-label">Qué mueve este score</h2>
        <p className="score-summary__sentence t-h2">{explanation.naturalLanguageSummary}</p>
        {otherFactors.length > 0 ? (
          <div className="score-summary__others">
            <p className="t-small muted">También pesan</p>
            <ul>
              {otherFactors.map((factor) => (
                <li key={factor.feature} className="t-small">
                  <span>{factor.feature}</span>
                  <span className={`t-mono-sm factor-${factor.direction}`}>
                    {`${factor.direction === 'increases' ? '+' : '−'}${formatDecimal(factor.contribution)} puntos`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  )
}
