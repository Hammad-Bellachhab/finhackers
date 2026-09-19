import { useState } from 'react'
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer,
  Scatter, Tooltip, XAxis, YAxis,
} from 'recharts'
import { getProfile } from '../api'
import type { BenchmarkRow, CompanyProfile } from '../api/types'
import { BLOCK_NAME, ContributionBars, Panel, axis, monthAxis, tooltip } from '../shared/charts'
import { formatMoney } from '../shared/format'
import { Pill } from '../shared/Pill'
import { ErrorNotice, Skeleton } from '../shared/States'
import { useAsync } from '../shared/useAsync'
import './company.css'

const pct = (v: number | null | undefined, d = 0) => (v == null ? '—' : `${(100 * v).toFixed(d)} %`)

/** Todo lo que enseñaba la ficha del dashboard de Diego, sobre los datos del motor. */
export function ProfileSections({ companyId }: { companyId: string }) {
  const { data, error, loading } = useAsync(() => getProfile(companyId), [companyId])
  if (loading) return <Skeleton height="30rem" />
  if (error) return <ErrorNotice error={error} />
  if (!data) return null
  return (
    <>
      <Snapshot p={data} />
      <WhySection p={data} />
      <TreasurySection p={data} />
      <BenchmarkSection p={data} />
      <ScenarioSection p={data} />
    </>
  )
}

function Snapshot({ p }: { p: CompanyProfile }) {
  const n = p.now
  const f = p.facts
  return (
    <section className="section">
      <h2>Ficha</h2>
      <div className="counts">
        <div className="count"><strong>{n.health}</strong><span>Salud / 100</span></div>
        <div className="count"><strong><Pill text={n.healthBand} /></strong><span>Banda</span></div>
        <div className="count"><strong><Pill text={n.trajectory} /></strong><span>Trayectoria</span></div>
        <div className="count"><strong><Pill text={n.signal} /></strong><span>Señal</span></div>
        <div className="count">
          <strong>{pct(n.p, 1)}</strong>
          <span>P(deterioro 6 m){n.pDelta1m != null && ` · ${n.pDelta1m >= 0 ? '+' : ''}${(100 * n.pDelta1m).toFixed(1)} pp`}</span>
        </div>
        <div className="count" title="Lo que vería un scoring tradicional solo con balance">
          <strong>{pct(n.pModelA, 1)}</strong><span>Modelo A (solo balance)</span>
        </div>
      </div>
      <p className="facts muted">
        Grupo {f.group} ({f.groupSize} empresas) · país {f.country ?? '—'} · ERP {f.erp ?? '—'} · banco principal {f.bank ?? '—'} ·{' '}
        {f.accounts} cuentas · {f.debtProducts} productos de financiación · historial {f.months} meses · cohorte {f.sizeCohort}
      </p>
      {p.changes.length > 0 && (
        <>
          <h2>Qué ha cambiado este mes</h2>
          <ul className="changes">
            {p.changes.map((c, i) => (
              <li key={i} className={c.direction === 'empeora' ? 'change-down' : 'change-up'}>
                <strong>{c.after}</strong>
                <span className="muted"> antes: {c.before.split(': ').slice(1).join(': ') || c.before}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function WhySection({ p }: { p: CompanyProfile }) {
  const deteriorated = p.history.filter((h) => h.deteriorated).map((h) => ({ month: h.month, mark: 5 }))
  const rows = p.history.map((h) => ({ ...h, mark: deteriorated.find((d) => d.month === h.month)?.mark }))
  const blocks = [...new Set(p.shap.map((s) => s.block))].map((b) => BLOCK_NAME[b] ?? b).join(' · ')
  return (
    <section className="section">
      <div className="grid-2">
        <Panel title="¿Por qué? Explicación SHAP" note={`Rojo empuja el riesgo hacia arriba, verde lo reduce. Bloques: ${blocks}.`}>
          <ContributionBars items={p.shap} />
        </Panel>
        <Panel title="Trayectoria de salud" note="Meses con desenlace conocido: dentro de muestra. Los posteriores, fuera de muestra. Cruz: se deterioró en los 6 meses siguientes.">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis {...monthAxis} />
              <YAxis domain={[0, 100]} {...axis} />
              <Tooltip {...tooltip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {[90, 75, 50].map((y) => <ReferenceLine key={y} y={y} stroke="var(--color-border-strong)" strokeDasharray="2 3" />)}
              <Line dataKey="health" name="Salud mensual" stroke="var(--color-text-muted)" strokeDasharray="2 3" dot={false} isAnimationActive={false} />
              <Line dataKey="smooth" name="Salud suavizada" stroke="var(--chart-1)" strokeWidth={3} dot={false} isAnimationActive={false} />
              <Line dataKey="modelA" name="Modelo A (proxy FICO)" stroke="var(--chart-4)" strokeDasharray="6 4" dot={false} isAnimationActive={false} />
              <Scatter dataKey="mark" name="Deterioro observado" fill="var(--color-danger)" shape="cross" isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </section>
  )
}

function TreasurySection({ p }: { p: CompanyProfile }) {
  const t = p.treasury.map((r) => ({
    ...r, outflowNeg: r.outflow == null ? null : -r.outflow,
    overduePct: r.overdueShare == null ? null : 100 * r.overdueShare,
  }))
  const money = (v: unknown) => formatMoney(Number(v), true)
  return (
    <section className="section">
      <h2>Series de tesorería</h2>
      <div className="grid-3">
        <Panel title="Caja y flujos">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={t} stackOffset="sign" margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis {...monthAxis} />
              <YAxis {...axis} tickFormatter={money} width={56} />
              <Tooltip {...tooltip} formatter={(v, n) => [money(v), n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="inflow" name="Cobros" stackId="f" fill="var(--color-success)" isAnimationActive={false} />
              <Bar dataKey="outflowNeg" name="Pagos" stackId="f" fill="var(--color-danger)" isAnimationActive={false} />
              <Line dataKey="cash" name="Caja reconstruida" stroke="var(--chart-1)" strokeWidth={3} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Retrasos de pago (días, 3 m)">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={t} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis {...monthAxis} />
              <YAxis {...axis} />
              <Tooltip {...tooltip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line dataKey="payDelay" name="Pago a proveedores" stroke="var(--color-warning)" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line dataKey="collectDelay" name="Cobro de clientes" stroke="var(--chart-3)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Morosidad y descubierto">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={t} margin={{ top: 8, right: 0, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis {...monthAxis} />
              <YAxis yAxisId="l" {...axis} unit="%" />
              <YAxis yAxisId="r" orientation="right" {...axis} />
              <Tooltip {...tooltip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="r" dataKey="interestCharges" name="Liquidaciones de intereses (3 m)" fill="var(--color-border-strong)" isAnimationActive={false} />
              <Line yAxisId="l" dataKey="overduePct" name="% facturas a pagar vencidas" stroke="var(--color-danger)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </section>
  )
}

// Etiqueta y si "más es peor", como en la vista Benchmarks de Diego.
const KPI: Record<string, [string, boolean, (v: number) => string]> = {
  score: ['Probabilidad de deterioro', true, (v) => pct(v, 1)],
  pay_dpd_mean_w3: ['Retraso de pago a proveedores (3 m, días)', true, (v) => v.toFixed(1)],
  pay_open_overdue_share_w3: ['% facturas a pagar vencidas (3 m)', true, (v) => pct(v)],
  io_ratio_w3: ['Ratio cobros / pagos (3 m)', false, (v) => v.toFixed(2)],
  cash_months_of_outflow: ['Meses de gasto cubiertos por la caja', false, (v) => v.toFixed(1)],
  hhi_in: ['Concentración de clientes (HHI)', true, (v) => v.toFixed(2)],
  interest_n_w3: ['Liquidaciones de intereses (3 m)', true, (v) => v.toFixed(0)],
}

function RangeBar({ row, own }: { row: BenchmarkRow; own: number | null | undefined }) {
  const [label, worseHigh, fmt] = KPI[row.kpi] ?? [row.kpi, true, (v: number) => v.toFixed(2)]
  const lo = Math.min(row.p25, own ?? row.p25)
  const hi = Math.max(row.p75, own ?? row.p75)
  const span = hi - lo || 1
  const x = (v: number) => `${4 + (92 * (v - lo)) / span}%`
  const tone = own == null ? '' : (worseHigh ? own > row.p75 : own < row.p25) ? 'bench-bad'
    : (worseHigh ? own < row.p25 : own > row.p75) ? 'bench-good' : 'bench-mid'
  return (
    <div className="bench">
      <div className="bench-head">
        <span>{label}</span>
        <strong className={tone}>{own == null ? 'sin dato' : fmt(own)}</strong>
      </div>
      <div className="bench-track" aria-label={`p25 ${fmt(row.p25)}, mediana ${fmt(row.p50)}, p75 ${fmt(row.p75)}`}>
        <span className="bench-iqr" style={{ left: x(row.p25), width: `calc(${x(row.p75)} - ${x(row.p25)})` }} />
        <span className="bench-median" style={{ left: x(row.p50) }} />
        {own != null && <span className={`bench-own ${tone}`} style={{ left: x(own) }} />}
      </div>
      <small className="muted">p25 {fmt(row.p25)} · mediana {fmt(row.p50)} · p75 {fmt(row.p75)}</small>
    </div>
  )
}

function BenchmarkSection({ p }: { p: CompanyProfile }) {
  const b = p.benchmark
  return (
    <section className="section">
      <h2>Frente a su cohorte</h2>
      {!b.cohort || b.rows.length === 0 ? (
        <p className="muted">Cohorte con menos de 10 empresas: no se muestra benchmark (regla de honestidad estadística).</p>
      ) : (
        <>
          <p className="muted facts">
            Cohorte: tamaño <strong>{b.cohort.size_cohort}</strong> × país <strong>{b.cohort.country_group}</strong> × grupo{' '}
            <strong>{b.cohort.group_bucket}</strong> → {b.rows[0].n} empresas
            {b.cohort.fallback_to_size_only && ' (respaldo solo por tamaño: la celda fina tenía menos de 10)'}.
            Barra: p25–p75 · raya: mediana · punto: esta empresa (rojo peor que p75, verde mejor que p25).
          </p>
          <div className="grid-2">
            {b.rows.map((r) => <RangeBar key={r.kpi} row={r} own={b.own?.[r.kpi]} />)}
          </div>
        </>
      )}
    </section>
  )
}

function ScenarioSection({ p }: { p: CompanyProfile }) {
  const [sel, setSel] = useState(0)
  const s = p.scenarios[sel]
  if (!s) return null
  const delta = s.after - s.before
  return (
    <section className="section">
      <h2>¿Y si…? Escenarios</h2>
      <div className="filters">
        {p.scenarios.map((x, i) => (
          <button key={x.id} type="button" className={i === sel ? 'chip chip-on' : 'chip'} aria-pressed={i === sel} onClick={() => setSel(i)}>
            {x.label}
          </button>
        ))}
      </div>
      <div className="grid-2">
        <Panel title="Salud del mes" note="El escenario mueve las variables que un tesorero controla o sufre y vuelve a puntuar con el mismo modelo.">
          <div className="counts">
            <div className="count"><strong>{s.before}</strong><span>Ahora</span></div>
            <div className="count"><strong>{s.after}</strong><span>Con el escenario</span></div>
            <div className="count">
              <strong className={delta >= 0 ? 'delta-up' : 'delta-down'}>{delta >= 0 ? '+' : ''}{delta.toFixed(1)}</strong>
              <span>Puntos</span>
            </div>
          </div>
          <details>
            <summary className="muted">Cambios aplicados a {Object.keys(s.changes).length} variables</summary>
            <ul className="scenario-changes">
              {Object.entries(s.changes).map(([k, v]) => <li key={k}><code>{k}</code> → {v == null ? '—' : v.toFixed(2)}</li>)}
            </ul>
          </details>
        </Panel>
        <Panel title="Explicación del score simulado">
          <ContributionBars items={s.explanation} />
        </Panel>
      </div>
    </section>
  )
}
