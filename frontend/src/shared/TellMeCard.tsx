import { useId, useState } from 'react'
import { getTellMe } from '../api'
import type { Insight, InsightKind } from '../api/types'
import { useAsync } from './useAsync'
import { TellMeLogo } from './TellMeLogo'
import './shared.css'

const KIND: Record<InsightKind, [string, string]> = {
  trend: ['↗', 'Tendencia'],
  anomaly: ['∿', 'Anomalía'],
  risk: ['!', 'Riesgo'],
  opportunity: ['+', 'Oportunidad'],
  action: ['→', 'Acción'],
}
const ORDEN = { alert: 0, watch: 1, info: 2 }
const fecha = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' })

function Mark() {
  return (
    <span className="tellme-mark" aria-hidden="true">
      <TellMeLogo size={20} />
    </span>
  )
}

function Eyebrow({ scope }: { scope?: string }) {
  return (
    <p className="tellme-eyebrow">
      <Mark /><span><strong>TellMe</strong>{scope && ` · ${scope}`}</span>
    </p>
  )
}

function InsightItem({ i }: { i: Insight }) {
  const [glyph, word] = KIND[i.kind]
  // Severidad: color del icono y, si no es normal, también en texto.
  const tone = i.severity === 'info' && i.kind === 'opportunity' ? 'good' : i.severity
  return (
    <li>
      <span className={`tellme-icon tellme-icon-${tone}`} aria-hidden="true">{glyph}</span>
      <div>
        <p className="tellme-kind">
          {word}
          {i.severity === 'watch' && <span className="pill pill-vigilar">Vigilar</span>}
          {i.severity === 'alert' && <span className="pill pill-riesgo">Alerta</span>}
        </p>
        <h3>{i.title}</h3>
        <p>{i.explanation}</p>
        {i.evidence.length > 0 && (
          <dl className="tellme-evidence">
            {i.evidence.map((e) => <div key={e.label}><dt>{e.label}</dt><dd>{e.value}</dd></div>)}
          </dl>
        )}
        {i.action && <p className="tellme-action"><strong>Qué hacer:</strong> {i.action}</p>}
      </div>
    </li>
  )
}

/** Tarjeta de TellMe (la IA de Embat). Sin companyId: el análisis de la cartera. */
export function TellMeCard({ companyId, name }: { companyId?: string; name?: string }) {
  const [intento, setIntento] = useState(0)
  const { data, error, loading } = useAsync(() => getTellMe(companyId), [companyId, intento])
  const titleId = useId()
  const scope = companyId ? `Análisis de ${name ?? companyId}` : 'Análisis de la cartera'

  if (loading) {
    return (
      <section className="tellme" aria-busy="true" aria-label="TellMe está analizando">
        <Eyebrow />
        <div className="skeleton" style={{ width: '60%', height: 24, margin: '12px 0 8px' }} />
        <div className="skeleton" style={{ width: '90%', height: 14, marginBottom: 6 }} />
        <div className="skeleton" style={{ width: '70%', height: 14, marginBottom: 16 }} />
        {[0, 1].map((k) => (
          <div key={k} style={{ display: 'flex', gap: 12, padding: '16px 0' }}>
            <div className="skeleton" style={{ width: 32, height: 32, flex: 'none' }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ width: '40%', height: 14, marginBottom: 6 }} />
              <div className="skeleton" style={{ width: '80%', height: 14 }} />
            </div>
          </div>
        ))}
      </section>
    )
  }
  if (error) {
    // No es ErrorNotice rojo: TellMe es complementario, un bloque rojo arriba asusta más que el dato.
    return (
      <section className="tellme" role="alert">
        <Eyebrow />
        <div className="tellme-error">
          <strong>No se ha podido cargar el análisis de TellMe.</strong>
          <span>{error.message}</span>
          <button type="button" onClick={() => setIntento((n) => n + 1)}>Reintentar</button>
        </div>
      </section>
    )
  }
  if (!data) {
    return (
      <section className="tellme tellme-small">
        <Eyebrow />
        <p className="tellme-note">TellMe aún no ha analizado {companyId ? 'esta empresa' : 'la cartera'}.</p>
        <p className="tellme-note tellme-eyebrow">El análisis se genera con cada carga de datos.</p>
      </section>
    )
  }

  const insights = [...data.insights].sort((a, b) => ORDEN[a.severity] - ORDEN[b.severity])
  const n = data.glossary.length
  return (
    <section className="tellme" aria-labelledby={titleId}>
      <Eyebrow scope={scope} />
      <h2 id={titleId} className="tellme-headline">{data.headline}</h2>
      <details className="tellme-more">
      <summary>Ver el análisis de TellMe</summary>
      <p className="tellme-summary">{data.summary}</p>
      {insights.length > 0 && (
        <ul className="tellme-insights">
          {insights.map((i) => <InsightItem key={i.id} i={i} />)}
        </ul>
      )}
      {n > 0 && (
        <details>
          <summary>Glosario ({n} {n === 1 ? 'término' : 'términos'})</summary>
          <dl className="tellme-glossary">
            {data.glossary.map((g) => <div key={g.term} style={{ display: 'contents' }}><dt>{g.term}</dt><dd>{g.plain}</dd></div>)}
          </dl>
        </details>
      )}
      <p className="tellme-footer">
        Generado por TellMe · {data.model} · <time dateTime={data.generatedAt}>{fecha.format(new Date(data.generatedAt))}</time>
        {' '}· Texto generado por IA a partir de los datos del motor; revisa las cifras.
      </p>
      </details>
    </section>
  )
}
