import type { CompanyScore, Metric } from '../api/types'
import { BandBadge } from '../shared/BandBadge'
import { Delta } from '../shared/Delta'
import { ScoreLine } from '../shared/ScoreLine'
import { formatDays, formatMonth, formatPct, formatRatio } from '../shared/format'
import './company.css'

function metricValue(m: Metric): string {
  if (m.unit === 'days') return formatDays(m.value)
  if (m.unit === 'ratio') return formatRatio(m.value)
  return formatPct(m.value)
}

export function PulseSection({ score }: { score: CompanyScore }) {
  return (
    <section className="section">
      <header className="company-head">
        <div>
          <h1>{score.name}</h1>
          {score.heldOut && (
            <span className="holdout" title="El modelo nunca vio esta empresa durante el entrenamiento">
              No vista en entrenamiento
            </span>
          )}
        </div>
        <div className="score-big">
          <span className="score-value">{score.score}</span>
          <BandBadge band={score.band} trend={score.trend} />
        </div>
      </header>

      <p className="deltas">
        <Delta value={score.delta1m} /> <span className="muted">vs. mes pasado</span>
        <span className="sep">·</span>
        <Delta value={score.delta3m} /> <span className="muted">vs. hace tres</span>
      </p>

      <ScoreLine series={score.series} />

      <h2>Qué lo ha movido</h2>
      <ul className="drivers">
        {score.drivers.map((d) => (
          <li key={d.id}>
            <span className={`driver-impact driver-${d.direction}`}>
              {d.impact > 0 ? '+' : ''}{d.impact}
            </span>
            <div>
              <strong>{d.label}</strong>
              <p>{d.detail}</p>
              <small>Se mueve desde {formatMonth(d.since)}</small>
            </div>
          </li>
        ))}
      </ul>

      <h2>Sus números</h2>
      <div className="metrics">
        {score.metrics.map((m) => (
          <div key={m.id} className={`metric metric-${m.status}`}>
            <span className="metric-label">{m.label}</span>
            <span className="metric-value">{metricValue(m)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
