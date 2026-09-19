import { useEffect, useState } from 'react'
import { simulate } from '../api'
import type { Decision, Metric, Simulation } from '../api/types'
import { Empty } from '../shared/States'
import { formatMoney } from '../shared/format'
import './company.css'

function SimulatorRow({ companyId, metric }: { companyId: string; metric: Metric }) {
  const [value, setValue] = useState(metric.value)
  const [sim, setSim] = useState<Simulation | null>(null)

  useEffect(() => {
    let vigente = true
    simulate(companyId, metric.id, value)
      .then((s) => { if (vigente) setSim(s) })
      .catch(() => { if (vigente) setSim(null) })
    return () => { vigente = false }
  }, [companyId, metric.id, value])

  const min = Math.max(0, Math.round(metric.reference * 0.5))
  const max = Math.round(Math.max(metric.value, metric.reference) * 1.5)
  const step = metric.unit === 'ratio' || metric.unit === 'pct' ? 0.01 : 1

  return (
    <div className="simulator">
      <label htmlFor="sim-input">
        Simular: {metric.label} —{' '}
        <strong>{metric.unit === 'days' ? Math.round(value) : value.toFixed(2)}</strong>
      </label>
      <input
        id="sim-input" type="range" min={min} max={max} step={step} value={value}
        aria-label={`Simular ${metric.label}`}
        onChange={(e) => setValue(Number(e.target.value))}
      />
      {sim && (
        <p className="simulator-out">
          Score proyectado{' '}
          <strong data-testid="sim-score" className={sim.scoreDelta >= 0 ? 'delta-up' : 'delta-down'}>
            {sim.scoreDelta > 0 ? '+' : ''}{sim.scoreDelta}
          </strong>
          {sim.cashDelta !== 0 && <> · caja {formatMoney(sim.cashDelta, true)}</>}
        </p>
      )}
    </div>
  )
}

export function DecisionsSection({
  companyId, decisions, metrics,
}: { companyId: string; decisions: Decision[]; metrics: Metric[] }) {
  if (decisions.length === 0) {
    return (
      <section className="section">
        <h2>Qué hacer</h2>
        <Empty message="No hay nada urgente que recomendar: los números están dentro de sus referencias." />
      </section>
    )
  }

  const simMetric = metrics.find((m) => m.id === decisions[0].metricId) ?? metrics[0]

  return (
    <section className="section">
      <h2>Qué hacer</h2>
      <ul className="decisions">
        {decisions.map((d) => (
          <li key={d.id}>
            <div className="decision-head">
              <strong>{d.title}</strong>
              <span className="decision-impact">
                {d.cashImpact > 0 && <span className="cash">{formatMoney(d.cashImpact)}</span>}
                <span className="delta delta-up">+{d.scoreImpact}</span>
              </span>
            </div>
            <p>{d.rationale}</p>
            <small>
              Ahora {Math.round(d.currentValue * 100) / 100} → objetivo{' '}
              {Math.round(d.targetValue * 100) / 100}
            </small>
            {d.caution && <p className="caution">⚠ {d.caution}</p>}
          </li>
        ))}
      </ul>

      {simMetric && <SimulatorRow companyId={companyId} metric={simMetric} />}
    </section>
  )
}
