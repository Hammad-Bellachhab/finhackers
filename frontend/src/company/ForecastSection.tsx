import type { CompanyScore, Forecast, ForecastBasis } from '../api/types'
import { ScoreLine } from '../shared/ScoreLine'
import { formatMonth, formatPct } from '../shared/format'
import './company.css'

/** De donde sale la banda. Se ensena siempre que el motor la calcule: una banda sin explicar es
 *  una banda en la que nadie confia, y en este producto la explicacion es parte del entregable. */
function BasisNote({ basis }: { basis: ForecastBasis }) {
  // Espacio duro entre el numero y el %: si no, el navegador parte "81 %" en dos lineas.
  const pct = (v: number) => formatPct(v).replace(' ', ' ')
  return (
    <p className="forecast-basis">
      <strong>
        El {pct(basis.probDrop5)} de las trayectorias simuladas pierde más de 5 puntos de salud en seis meses
        {basis.probRisk >= 0.01 && <> y el {pct(basis.probRisk)} acaba en riesgo</>}.
      </strong>
      {' '}
      La banda del {basis.interval} % no es una fórmula: son los percentiles 10 y 90 de{' '}
      {basis.paths.toLocaleString('es-ES')} trayectorias sorteadas entre {basis.companies} empresas
      que estuvieron en la misma situación que esta, y lo que de verdad les pasó después.
      {basis.coverage !== null && (
        <> Medido en las empresas que el modelo nunca vio, el {pct(basis.coverage)} de lo que pasó
        cayó dentro de la banda.</>
      )}
    </p>
  )
}

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

      {forecast.basis && <BasisNote basis={forecast.basis} />}

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
