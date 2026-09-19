import type { CompanyScore, Forecast, ForecastBasis, ScorePoint } from '../api/types'
import { ScoreLine } from '../shared/ScoreLine'
import { formatMonth } from '../shared/format'
import './company.css'

/** De donde sale la banda. Se ensena siempre que el motor la calcule: una banda sin explicar es
 *  una banda en la que nadie confia, y en este producto la explicacion es parte del entregable. */
function BasisNote({ basis, simulado }: { basis: ForecastBasis; simulado: boolean }) {
  // El % va con espacio duro (&nbsp;): si no, el navegador parte "81 %" entre dos lineas.
  const pct = (v: number) => Math.round(v * 100)
  return (
    <p className="forecast-basis">
      <strong>
        El {pct(basis.probDrop5)}&nbsp;% de las trayectorias simuladas pierde más de 5 puntos de
        salud en seis meses{basis.probRisk >= 0.01 && <> y el {pct(basis.probRisk)}&nbsp;% acaba en riesgo</>}.
      </strong>
      {' '}
      La banda del {basis.interval}&nbsp;% no es una fórmula: son los percentiles 10 y 90 de{' '}
      {basis.paths.toLocaleString('es-ES')} trayectorias sorteadas entre {basis.companies} empresas
      que estuvieron en la misma situación que esta, y lo que de verdad les pasó después.
      {basis.coverage !== null && (
        <> Medido en las empresas que el modelo nunca vio, el {pct(basis.coverage)}&nbsp;% de lo que
        pasó cayó dentro de la banda.</>
      )}
      {simulado && (
        <> Con el plan aplicado se desplaza la banda entera (la línea gris punteada es la previsión
        sin el plan): el ancho sigue siendo el de la situación de hoy, no el de la empresa que sería.</>
      )}
    </p>
  )
}

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

  // El plan del simulador desplaza la previsión y la banda entera del montecarlo.
  const shift = (pts: ScorePoint[]) => simulatedDelta === 0 ? pts
    : pts.map((p) => ({ ...p, score: Math.max(0, Math.min(100, Number((p.score + simulatedDelta).toFixed(1)))) }))

  return (
    <section className="section">
      <h2>Hacia dónde va</h2>

      <ScoreLine
        series={score.series}
        projection={shift(forecast.horizon)}
        bandLow={shift(forecast.bandLow)}
        bandHigh={shift(forecast.bandHigh)}
        // Escala fija a la previsión sin plan: si se reajustara, todo se movería junto y el cambio no se vería.
        domainFrom={[...score.series, ...forecast.horizon, ...forecast.bandLow, ...forecast.bandHigh]}
        ghost={simulatedDelta === 0 ? [] : forecast.horizon}
        markers={d ? [{ month: d.detectedAt, label: 'Detectado' }] : []}
      />

      {forecast.basis && <BasisNote basis={forecast.basis} simulado={simulatedDelta !== 0} />}

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
