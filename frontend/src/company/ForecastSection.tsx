import { useMemo } from 'react'
import type { CompanyScore, Forecast } from '../api/types'
import { ScoreLine } from '../shared/ScoreLine'
import { formatMonth } from '../shared/format'
import './company.css'

export function ForecastSection({
  score,
  forecast,
  simulatedDelta = 0,
}: {
  score: CompanyScore
  forecast: Forecast
  simulatedDelta?: number
}) {
  const d = forecast.detection

  // Desplazar dinámicamente la previsión del score con el delta simulado
  const shiftedHorizon = useMemo(() => {
    if (simulatedDelta === 0) return forecast.horizon
    return forecast.horizon.map((p) => ({
      ...p,
      score: Math.max(0, Math.min(100, Number((p.score + simulatedDelta).toFixed(1)))),
    }))
  }, [forecast.horizon, simulatedDelta])

  // Desplazar dinámicamente la banda inferior de Montecarlo
  const shiftedBandLow = useMemo(() => {
    if (simulatedDelta === 0) return forecast.bandLow
    return forecast.bandLow.map((p) => ({
      ...p,
      score: Math.max(0, Math.min(100, Number((p.score + simulatedDelta).toFixed(1)))),
    }))
  }, [forecast.bandLow, simulatedDelta])

  // Desplazar dinámicamente la banda superior de Montecarlo
  const shiftedBandHigh = useMemo(() => {
    if (simulatedDelta === 0) return forecast.bandHigh
    return forecast.bandHigh.map((p) => ({
      ...p,
      score: Math.max(0, Math.min(100, Number((p.score + simulatedDelta).toFixed(1)))),
    }))
  }, [forecast.bandHigh, simulatedDelta])

  return (
    <section className="section">
      <h2>Hacia dónde va</h2>

      <ScoreLine
        series={score.series}
        projection={shiftedHorizon}
        bandLow={shiftedBandLow}
        bandHigh={shiftedBandHigh}
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
