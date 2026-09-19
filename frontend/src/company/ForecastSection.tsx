import type { CompanyScore, Forecast } from '../api/types'
import { ScoreLine } from '../shared/ScoreLine'
import { formatMonth } from '../shared/format'
import './company.css'

export function ForecastSection({ score, forecast }: { score: CompanyScore; forecast: Forecast }) {
  const d = forecast.detection

  return (
    <section className="section">
      <h2>Hacia dónde va</h2>

      <ScoreLine
        series={score.series}
        projection={forecast.horizon}
        bandLow={forecast.bandLow}
        bandHigh={forecast.bandHigh}
        markers={d ? [{ month: d.detectedAt, label: 'Detectado' }] : []}
      />

      <div className={`stability stability-${forecast.stability}`}>
        <strong>{forecast.stability === 'dip' ? 'Bache puntual' : 'Deterioro estructural'}</strong>
        <span>{forecast.stabilityNote}</span>
      </div>

      {d && (
        <>
          <h2>Cuándo se vio venir</h2>
          <div className="anticipation-track">
            <div className="anticipation-point">
              <span className="dot dot-detected" />
              <strong>{formatMonth(d.detectedAt)}</strong>
              <small>Lo detectó el sistema</small>
            </div>
            <div className="anticipation-gap">
              <span>{d.monthsAhead} meses antes</span>
            </div>
            <div className="anticipation-point">
              <span className="dot dot-evident" />
              <strong>{formatMonth(d.evidentAt)}</strong>
              <small>Fue evidente en sus números</small>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
