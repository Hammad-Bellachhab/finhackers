import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getModelReport } from '../api'
import type { ModelReport } from '../api/types'
import { BLOCK_NAME, Panel, axis, tooltip } from '../shared/charts'
import { ErrorNotice, Skeleton } from '../shared/States'
import { useAsync } from '../shared/useAsync'
import './portfolio.css'

const f3 = (v: number) => v.toFixed(3)
const pct = (v: number) => `${Math.round(100 * v)} %`
const signed = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(3)}`
const BLOCK_COLORS = ['var(--chart-4)', 'var(--color-danger)', 'var(--chart-1)', 'var(--color-warning)', 'var(--color-success)', 'var(--chart-3)']

/** "Rendimiento del modelo" del dashboard de Diego: A (solo balance) frente a B (+ comportamiento). */
export function ModelView() {
  const { data, error, loading } = useAsync(() => getModelReport(), [])
  if (loading) return <Skeleton height="30rem" />
  if (error) return <ErrorNotice error={error} />
  if (!data) return null
  return (
    <>
      <Thesis m={data} />
      <ModelsTable m={data} />
      <div className="grid-2 gap-top">
        <Anticipation m={data} />
        <Unseen m={data} />
      </div>
      <div className="grid-2 gap-top">
        <Stability m={data} />
        <Ablation m={data} />
      </div>
      <Importance m={data} />
      <Errors m={data} />
      <Figures m={data} />
    </>
  )
}

function Thesis({ m }: { m: ModelReport }) {
  const h = m.holdout
  const lg = m.lift.lgbm
  return (
    <>
      <h2>La tesis</h2>
      <p className="legend-line">
        La tesorería diaria anticipa el deterioro que un scoring de balance no ve. <strong>Modelo A</strong>: solo bloque
        estructural ({m.feature_blocks.A} variables, lo que ve un banco). <strong>Modelo B</strong>: A + comportamiento
        ({m.n_features} variables).
      </p>
      <div className="counts">
        <div className="count"><strong>{f3(h.lgbm_A.auc_pr)}</strong><span>AUC-PR modelo A</span></div>
        <div className="count"><strong>{f3(h.lgbm_B.auc_pr)}</strong><span>AUC-PR modelo B ({signed(lg.lift_mean)})</span></div>
        <div className="count"><strong>[{signed(lg.lift_ci[0])}, {signed(lg.lift_ci[1])}]</strong><span>IC 95 % de la mejora (bootstrap)</span></div>
        <div className="count"><strong>{pct(m.shap_block_importance.behavioural_share)}</strong><span>Peso SHAP del comportamiento (B–F)</span></div>
      </div>
      <p className="muted legend-line">
        Holdout: {h.lgbm_B.n.toLocaleString('es-ES')} filas empresa-mes de los últimos meses con desenlace conocido,
        tasa base {pct(h.lgbm_B.base_rate)}. Entrenamiento con embargo de {String(m.label.embargo_months ?? 7)} meses.
        Modelo servido: <strong>{m.main_model}</strong> (versión {m.version}).
      </p>
    </>
  )
}

function ModelsTable({ m }: { m: ModelReport }) {
  return (
    <Panel title="Todos los modelos en el holdout">
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Modelo</th><th>AUC-PR</th><th>AUC-ROC</th><th>Precisión top 50</th><th>Recall top 10 %</th><th>Brier</th></tr></thead>
          <tbody>
            {Object.entries(m.holdout).map(([k, v]) => (
              <tr key={k} className={k === m.main_model ? 'row-main' : undefined}>
                <td>{k}{k === m.main_model && ' · servido'}</td>
                <td>{f3(v.auc_pr)}</td><td>{f3(v.auc_roc)}</td><td>{f3(v['p@50'])}</td>
                <td>{f3(v['r@top10pct'])}</td><td>{f3(v.brier)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function Anticipation({ m }: { m: ModelReport }) {
  const a = m.anticipation
  const dist = Object.entries(a.lead_distribution).map(([k, v]) => ({ meses: k, eventos: v }))
  return (
    <Panel
      title="Anticipación (criterio del reto)"
      note={`El ${pct(a.band_flip_rate)} de los cambios de banda se revierte al mes siguiente. Fuera de muestra desde ${a.out_of_sample_from}. ${a.definition}`}
    >
      <div className="counts">
        <div className="count"><strong>{a.n_events}</strong><span>Deterioros reales</span></div>
        <div className="count"><strong>{pct(a.share_anticipated)}</strong><span>Anticipados</span></div>
        <div className="count"><strong>{a.lead_months_median} m</strong><span>Adelanto mediano</span></div>
        <div className="count"><strong>{pct(a.false_alert_rate)}</strong><span>Falsas alertas</span></div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={dist} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="meses" {...axis} label={{ value: 'meses de adelanto', position: 'insideBottom', offset: -2, fill: 'var(--color-text-muted)', fontSize: 11 }} />
          <YAxis {...axis} />
          <Tooltip {...tooltip} />
          <Bar dataKey="eventos" fill="var(--chart-1)" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  )
}

function Unseen({ m }: { m: ModelReport }) {
  const u = m.holdout_unseen_companies
  const b = u.lgbm_B.unseen
  const a = u.lgbm_A.unseen
  return (
    <Panel
      title="Generalización a empresas no vistas"
      note={`Se aparta del entrenamiento el 25 % de los grupos empresariales (grupos enteros) y se evalúa en el holdout. Mejora B − A en no vistas: ${signed(u.lift_lgbm.lift_mean)} AUC-PR, IC 95 % [${signed(u.lift_lgbm.lift_ci[0])}, ${signed(u.lift_lgbm.lift_ci[1])}]. El mismo modelo en empresas vistas: AUC-PR ${f3(u.lgbm_B.seen_same_model.auc_pr)}.`}
    >
      <div className="counts">
        <div className="count"><strong>{u.n_unseen_companies}</strong><span>Empresas apartadas</span></div>
        <div className="count"><strong>{f3(b.auc_pr)}</strong><span>AUC-PR B (A: {f3(a.auc_pr)})</span></div>
        <div className="count"><strong>{f3(b.auc_roc)}</strong><span>AUC-ROC B (A: {f3(a.auc_roc)})</span></div>
      </div>
      <p className="legend-line">
        <strong>El balance memoriza empresas; el comportamiento generaliza.</strong>
      </p>
    </Panel>
  )
}

function Stability({ m }: { m: ModelReport }) {
  return (
    <Panel title="Estabilidad temporal (validación cruzada)" note={`Brier sin → con calibración Platt: ${f3(m.calibration.brier_raw)} → ${f3(m.calibration.brier_cal)}.`}>
      <table className="data-table">
        <thead><tr><th>Modelo</th><th>AUC-PR medio</th><th>Desviación</th></tr></thead>
        <tbody>
          {Object.entries(m.cv).map(([k, v]) => (
            <tr key={k}><td>{k}</td><td>{f3(v.auc_pr_mean)}</td><td>{f3(v.auc_pr_std)}</td></tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}

function Ablation({ m }: { m: ModelReport }) {
  const rows = Object.entries(m.ablation).map(([k, v]) => ({
    exp: k.replace('A_plus_', 'A + ').replace('B_minus_', 'B − '), delta: v.delta_holdout, baseline: v.reference,
  }))
  return (
    <Panel title="Ablación por bloques (Δ AUC-PR en holdout)" note="Verde: lo que gana el modelo A al añadir un bloque. Rojo: lo que pierde el B al quitarlo (los bloques se solapan en parte).">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="exp" {...axis} interval={0} angle={-30} textAnchor="end" height={50} />
          <YAxis {...axis} tickFormatter={(v) => Number(v).toFixed(2)} />
          <Tooltip {...tooltip} formatter={(v) => [signed(Number(v)), 'Δ AUC-PR']} />
          <Bar dataKey="delta" isAnimationActive={false}>
            {rows.map((r) => <Cell key={r.exp} fill={r.baseline === 'lgbm_A' ? 'var(--color-success)' : 'var(--color-danger)'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  )
}

function Importance({ m }: { m: ModelReport }) {
  const blocks = Object.entries(m.shap_block_importance.by_block_share).map(([k, v]) => ({ bloque: `${k} · ${BLOCK_NAME[k] ?? k}`, cuota: v }))
  return (
    <>
      <h2>Qué mira el modelo</h2>
      <div className="grid-2">
        <Panel title="Importancia global (TreeSHAP) por bloque">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={blocks} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="bloque" {...axis} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis {...axis} tickFormatter={(v) => pct(Number(v))} />
              <Tooltip {...tooltip} formatter={(v) => [pct(Number(v)), 'cuota']} />
              <Bar dataKey="cuota" isAnimationActive={false}>
                {blocks.map((b, i) => <Cell key={b.bloque} fill={BLOCK_COLORS[i % BLOCK_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Las 20 variables que más pesan">
          <div className="table-scroll tall">
            <table className="data-table">
              <thead><tr><th>Variable</th><th>Bloque</th><th>Media |SHAP|</th></tr></thead>
              <tbody>
                {m.top_features.slice(0, 20).map((t) => (
                  <tr key={t.feature}><td>{t.label}</td><td>{t.block} · {BLOCK_NAME[t.block] ?? ''}</td><td>{t.mean_abs_shap.toFixed(4)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  )
}

function Errors({ m }: { m: ModelReport }) {
  const e = m.error_analysis
  const c = e.confusion_top15pct
  if (!c) return null
  return (
    <>
      <h2>Análisis de errores (holdout, 15 % más arriesgado marcado)</h2>
      <div className="counts">
        <div className="count"><strong>{c.TP}</strong><span>Aciertos: se deterioraron</span></div>
        <div className="count"><strong>{c.FN}</strong><span>Se escaparon</span></div>
        <div className="count"><strong>{c.FP}</strong><span>Falsas alarmas</span></div>
        <div className="count"><strong>{c.TN}</strong><span>Sanas bien leídas</span></div>
      </div>
      {e.fn_dominant_component != null && (
        <p className="legend-line">Componente de deterioro dominante en las que se escaparon: <strong>{String(Object.entries(e.fn_dominant_component as object).map(([k, v]) => `${k} ${v}`).join(' · ') || e.fn_dominant_component)}</strong></p>
      )}
      {e.reading && <p className="legend-line muted">{e.reading}</p>}
    </>
  )
}

const FIG_TITLE: Record<string, string> = {
  'pr_curves_holdout.png': 'Curvas precisión-recall (holdout)',
  'calibration_holdout.png': 'Calibración (holdout)',
  'shap_beeswarm.png': 'SHAP: efecto de cada variable',
  'shap_global_top20.png': 'SHAP: top 20 variables',
  'shap_by_block.png': 'SHAP por bloque',
  'ablation.png': 'Ablación por bloques',
}

function Figures({ m }: { m: ModelReport }) {
  return (
    <>
      <h2>Diagramas del entrenamiento</h2>
      <div className="grid-2">
        {m.figures.map((f) => (
          <Panel key={f} title={FIG_TITLE[f] ?? f}>
            <img className="figure" src={`/data/figures/${f}`} alt={FIG_TITLE[f] ?? f} loading="lazy" />
          </Panel>
        ))}
      </div>
    </>
  )
}
