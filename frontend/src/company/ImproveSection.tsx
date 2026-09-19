import { useEffect, useMemo, useRef, useState } from 'react'
import { getPlan } from '../api'
import type { Decision, Drag, Metric, MetricId, Plan } from '../api/types'
import { Empty } from '../shared/States'
import { formatMoney } from '../shared/format'
import { useAsync } from '../shared/useAsync'
import './company.css'

/** Cómo se enseña el valor de cada métrica: los porcentajes viven en 0-1 dentro del modelo. */
function formatValue(v: number, unit: Metric['unit']): string {
  if (unit === 'pct') return `${Math.round(v * 100)} %`
  if (unit === 'ratio') return v.toFixed(2)
  return `${Math.round(v)} d`
}

/** Recorrido del slider. Mismo rango que la rejilla precalculada del motor
 *  (pipeline/src/metrics.py, slider_range): si divergen, el plan degradado deja de casar. */
function range(metric: Metric): { min: number; max: number; step: number } {
  return {
    min: Math.max(0, metric.reference * 0.5),
    max: Math.max(metric.value, metric.reference) * 1.5,
    step: metric.unit === 'days' ? 1 : 0.01,
  }
}

/** Espera a que el usuario suelte el slider antes de pedir el plan: cada peticion recalcula el
 *  ensemble entero y no tiene sentido lanzarla en cada pixel. */
function useSettled<T>(value: T, ms = 250): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return settled
}

type Lever = {
  metric: Metric
  target: number
  cashImpact: number
  caution: string | null
  title: string
}

/** Las palancas que se le ofrecen a esta empresa: las metricas que no estan en su sitio, con el
 *  objetivo que ya propuso el motor (decisions.json) y, si no hay, su propia referencia.
 *
 *  `ccc` queda fuera a proposito: es dso menos dpo y mueve las mismas features que dso, asi que
 *  ofrecer las dos dejaria al usuario pisando una palanca con otra sin verlo. */
function buildLevers(decisions: Decision[], metrics: Metric[]): Lever[] {
  const byMetric = new Map(decisions.map((d) => [d.metricId, d]))
  return metrics
    .filter((m) => m.id !== 'ccc' && (byMetric.has(m.id) || m.status !== 'ok'))
    .map((m) => {
      const d = byMetric.get(m.id)
      return {
        metric: m,
        target: d ? d.targetValue : m.reference,
        cashImpact: d?.cashImpact ?? 0,
        caution: d?.caution ?? null,
        title: d?.title ?? `Mover ${m.label.toLowerCase()}`,
      }
    })
}

export function ImproveSection({
  companyId,
  decisions,
  metrics,
}: {
  companyId: string
  decisions: Decision[]
  metrics: Metric[]
}) {
  const levers = useMemo(() => buildLevers(decisions, metrics), [decisions, metrics])

  const [discarded, setDiscarded] = useState<MetricId[]>([])
  const [values, setValues] = useState<Partial<Record<MetricId, number>>>(() =>
    Object.fromEntries(levers.map((l) => [l.metric.id, l.target])),
  )

  const targets = useMemo(() => {
    const out: Partial<Record<MetricId, number>> = {}
    for (const l of levers) {
      if (!discarded.includes(l.metric.id)) out[l.metric.id] = values[l.metric.id] ?? l.target
    }
    return out
  }, [levers, discarded, values])

  // Se serializa porque useAsync compara dependencias por identidad y el objetivo es un objeto nuevo
  // en cada render; ademas asi el debounce se aplica al contenido, no a la referencia.
  const targetsKey = JSON.stringify(targets)
  const key = useSettled(targetsKey)
  const plan = useAsync(() => getPlan(companyId, JSON.parse(key)), [companyId, key])

  // useAsync vacia `data` en cada recarga (shared/useAsync.ts), asi que sin esto el resumen se
  // desmonta en cada movimiento del slider, el documento encoge y la pagina salta bajo el cursor.
  // Se guarda con que objetivos se pidio, para saber si lo que se enseña sigue valiendo.
  const ultimo = useRef<{ plan: Plan; key: string } | null>(null)
  if (plan.data) ultimo.current = { plan: plan.data, key }
  const vista = plan.data ?? ultimo.current?.plan ?? null

  // El diagnostico es de la empresa, no del plan: no cambia porque se muevan las palancas. Se fija
  // con la primera respuesta y no se vuelve a tocar, porque ademas el motor devuelve 6 y la rejilla
  // precalculada entre 0 y 5; repintarlo en mitad de un arrastre movia la pagina 200-300 px.
  const drags = useRef<Drag[]>([])
  if (vista && drags.current.length === 0) drags.current = vista.drags

  // Desfasado mientras lo que se ve no corresponde a donde estan los sliders: cubre el debounce
  // (aun sin peticion en vuelo), la peticion en curso y el fallo que deja el plan anterior.
  const desfasado = !vista || ultimo.current?.key !== targetsKey

  if (levers.length === 0) {
    return (
      <section className="section">
        <h2>Cómo subir tu score</h2>
        <Empty message="No hay nada que corregir: sus números están dentro de sus referencias." />
      </section>
    )
  }

  const toggle = (id: MetricId) =>
    setDiscarded((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]))

  const deltaOf = (id: MetricId) => vista?.levers.find((l) => l.metricId === id)?.scoreDelta

  return (
    <section className="section improve">
      <h2>Cómo subir tu score</h2>

      {drags.current.length > 0 && (
        <>
          <h3>Qué se lo está bajando</h3>
          <ul className="drags">
            {drags.current.map((d) => {
              const lever = levers.find((l) => l.metric.id === d.metricId)
              return (
                <li key={d.id}>
                  <span className="drag-impact">{d.impact}</span>
                  <span className="drag-label">{d.label}</span>
                  <span className="drag-fix muted">
                    {lever ? `se corrige con: ${lever.metric.label}` : 'sin palanca directa'}
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <h3>Qué puede hacer</h3>
      <p className="muted">
        Descarte lo que su empresa no pueda o no quiera hacer: el plan se recalcula con el resto.
      </p>

      <ul className="levers">
        {levers.map((l) => {
          const off = discarded.includes(l.metric.id)
          const value = values[l.metric.id] ?? l.target
          const { min, max, step } = range(l.metric)
          const delta = off ? undefined : deltaOf(l.metric.id)
          return (
            <li key={l.metric.id} className={off ? 'lever lever-off' : 'lever'}>
              <div className="lever-head">
                <strong>{l.title}</strong>
                <button
                  type="button"
                  className={off ? 'chip chip-on' : 'chip'}
                  aria-pressed={off}
                  onClick={() => toggle(l.metric.id)}
                >
                  {off ? 'Recuperar' : 'Descartar'}
                </button>
              </div>

              <div className="lever-slide">
                <label htmlFor={`lever-${l.metric.id}`}>
                  {l.metric.label}: <strong>{formatValue(value, l.metric.unit)}</strong>
                  {off && <span className="muted"> — descartada</span>}
                </label>
                <input
                  id={`lever-${l.metric.id}`}
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={value}
                  disabled={off}
                  aria-label={`Mover ${l.metric.label}`}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [l.metric.id]: Number(e.target.value) }))
                  }
                />
                <span className="lever-delta">
                  {delta === undefined ? (
                    <span className="muted">—</span>
                  ) : (
                    <strong className={delta >= 0 ? 'delta-up' : 'delta-down'}>
                      {`${delta > 0 ? '+' : ''}${delta}`}
                    </strong>
                  )}
                </span>
              </div>

              {!off && l.cashImpact > 0 && (
                <small className="muted">Libera {formatMoney(l.cashImpact)} de caja</small>
              )}
              {!off && l.caution && <p className="caution">⚠ {l.caution}</p>}
            </li>
          )
        })}
      </ul>

      <div className={desfasado ? 'plan-total plan-total-stale' : 'plan-total'}>
        {vista ? (
          <>
            <p>
              Con este plan su salud pasa de <strong>{vista.baseHealth}</strong> a{' '}
              <strong data-testid="plan-score">{vista.planHealth}</strong>{' '}
              <span className={vista.scoreDelta >= 0 ? 'delta-up' : 'delta-down'}>
                {`(${vista.scoreDelta > 0 ? '+' : ''}${vista.scoreDelta} puntos)`}
              </span>
            </p>
            <small className="muted">
              {plan.error
                ? 'No se ha podido actualizar: este es el último plan que sí se calculó.'
                : desfasado
                  ? 'Recalculando con el modelo…'
                  : vista.exact
                    ? 'Repuntuado con el modelo, aplicando todas las palancas a la vez.'
                    : 'Estimación: suma el efecto de cada palanca por separado, sin tener en cuenta cómo se solapan.'}
            </small>
          </>
        ) : (
          <p className="muted">
            {plan.error ? 'No se ha podido calcular el plan.' : 'Calculando el plan…'}
          </p>
        )}
      </div>
    </section>
  )
}
