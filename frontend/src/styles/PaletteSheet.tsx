/* Muestra viva de los tokens de `tokens.css`.
 *
 * Existe para que el equipo vea la paleta aplicada de verdad (y en modo oscuro)
 * en vez de fiarse de una tabla de hex. Se borra el dia que estorbe. */

import './palette-sheet.css'

type Swatch = { token: string; label: string }

const SURFACE: Swatch[] = [
  { token: '--color-bg', label: 'bg' },
  { token: '--color-surface', label: 'surface' },
  { token: '--color-surface-pressed', label: 'pressed' },
  { token: '--color-border', label: 'border' },
  { token: '--color-border-strong', label: 'border fuerte' },
]

const ACTION: Swatch[] = [
  { token: '--color-accent', label: 'accent' },
  { token: '--color-accent-hover', label: 'hover' },
  { token: '--color-accent-pressed', label: 'pressed' },
  { token: '--color-accent-soft', label: 'soft' },
]

const STATE: Swatch[] = [
  { token: '--color-success', label: 'success' },
  { token: '--color-warning', label: 'warning' },
  { token: '--color-danger', label: 'danger' },
]

const BRAND: Swatch[] = [
  { token: '--embat-navy', label: 'navy' },
  { token: '--embat-purple', label: 'purple' },
  { token: '--embat-purple-medium', label: 'purple med' },
  { token: '--embat-aqua', label: 'aqua' },
  { token: '--embat-pink', label: 'pink' },
  { token: '--embat-warm', label: 'warm' },
  { token: '--embat-coral', label: 'coral' },
]

const CHART: Swatch[] = [1, 2, 3, 4, 5, 6].map((n) => ({
  token: `--chart-${n}`,
  label: `chart ${n}`,
}))

const BANDS = [
  { token: '--color-band-healthy', label: 'Sano', hint: 'nivel alto' },
  { token: '--color-band-improving', label: 'Mejorando', hint: '45 → 65' },
  { token: '--color-band-stable', label: 'Estable', hint: 'sin señal' },
  { token: '--color-band-slipping', label: 'Torciéndose', hint: '82 → 68' },
  { token: '--color-band-risk', label: 'En riesgo', hint: 'nivel bajo' },
]

function Row({ title, swatches }: { title: string; swatches: Swatch[] }) {
  return (
    <section className="row">
      <h3>{title}</h3>
      <div className="swatches">
        {swatches.map((s) => (
          <figure key={s.token}>
            <div className="chip" style={{ background: `var(${s.token})` }} />
            <figcaption>{s.label}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

export function PaletteSheet() {
  return (
    <div className="sheet">
      <div className="hero">
        <h1>Paleta de Embat, aplicada</h1>
        <p>
          Tokens extraídos del design system de embat.io. Los componentes usan siempre los
          semánticos (<code>--color-*</code>), nunca los crudos, así el modo oscuro sale
          gratis: cambia el tema del sistema y esta página entera se adapta.
        </p>
      </div>

      <Row title="Superficie" swatches={SURFACE} />
      <Row title="Acción" swatches={ACTION} />
      <Row title="Estado" swatches={STATE} />
      <Row title="Marca" swatches={BRAND} />
      <Row title="Categóricos de gráfica" swatches={CHART} />

      <section className="row">
        <h3>Bandas de score</h3>
        <div className="bands">
          {BANDS.map((b) => (
            <div className="band" key={b.token}>
              <span className="dot" style={{ background: `var(${b.token})` }} />
              <strong>{b.label}</strong>
              <span className="hint">{b.hint}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="row">
        <h3>Gradiente de marca</h3>
        <div className="gradient" />
      </section>
    </div>
  )
}
