import { getEvidence, getPortfolio, getProviders } from '../api'
import { TellMeLogo, TellMeWordmark } from '../shared/TellMeLogo'
import { ThemeToggle } from '../shared/ThemeToggle'
import { useAsync } from '../shared/useAsync'
import './landing.css'

// Códigos de ERP del dataset → nombre comercial. Lo que no está aquí se enseña tal cual.
const ERP_NAME: Record<string, string> = {
  businessCentral: 'Microsoft Business Central', 'Microsoft Business Central': 'Microsoft Business Central',
  netsuite: 'Oracle NetSuite', sage200: 'Sage 200', sageX3: 'Sage X3', businessOne: 'SAP Business One',
  dynamicsAx: 'Microsoft Dynamics AX', a3: 'A3', holded: 'Holded', odoo: 'Odoo', sap: 'SAP',
}

// useGrouping 'always': en es-ES los números de 4 cifras no llevan punto por defecto (1286 → 1.286).
const nf = (n: number) => n.toLocaleString('es-ES', { useGrouping: 'always' })

function TopNav() {
  return (
    <header className="lp-nav">
      <a href="#/" className="logo-link lp-logo" aria-label="Embat, inicio"><span className="logo" /></a>
      <nav aria-label="Secciones">
        <a href="#/xray">X-Ray</a>
        <a href="#/app">Demo</a>
      </nav>
      <ThemeToggle className="lp-theme-toggle" />
      <a href="#/xray" className="lp-btn lp-btn-primary lp-btn-sm">Descubre X-Ray</a>
    </header>
  )
}

/** Onda de luz del fondo del héroe. Decorativa: fuera del árbol de accesibilidad. */
function Wave() {
  return (
    <div className="lp-wave" aria-hidden="true">
      <i className="lp-wave-a" />
      <i className="lp-wave-b" />
    </div>
  )
}

/** Inicio de Embat: qué hace la plataforma, con qué está conectada y qué añade X-Ray encima.
 *  El logo siempre trae aquí. */
export function EmbatHome() {
  const providers = useAsync(() => getProviders(), [])
  const portfolio = useAsync(() => getPortfolio(), [])
  const bancos = (providers.data?.providers ?? []).filter((p) => p.kind === 'banco' && !/^other/i.test(p.name)).slice(0, 10)
  const erps = Object.entries(
    (portfolio.data?.rows ?? []).reduce<Record<string, number>>((acc, r) => {
      const name = r.erp && r.erp !== 'NONE' ? ERP_NAME[r.erp] ?? r.erp : null
      if (name) acc[name] = (acc[name] ?? 0) + 1
      return acc
    }, {}),
  ).sort((a, b) => b[1] - a[1]).slice(0, 8)

  return (
    <div className="lp">
      <TopNav />

      <section className="lp-hero">
        <Wave />
        <div className="lp-hero-in">
          <p className="lp-eyebrow reveal">Plataforma de tesorería</p>
          <h1 className="reveal">Toda la tesorería de tu grupo, conectada y al día</h1>
          <p className="lp-lead reveal">
            Embat se conecta a tus bancos y a tu ERP, concilia los movimientos solo y mantiene
            la posición de caja al minuto. Sin exportar ficheros ni cuadrar hojas de cálculo.
          </p>
          <div className="lp-actions reveal">
            <a href="#/xray" className="lp-btn lp-btn-primary">Descubre X-Ray</a>
            <a href="#/app" className="lp-btn lp-btn-ghost">Ver la demo</a>
          </div>
        </div>
      </section>

      <section className="lp-section">
        <h2 className="lp-h2">Una plataforma.<br />Todo el flujo de tesorería.</h2>
        <div className="lp-grid-4">
          {[
            ['Tu caja, en tiempo real', 'Posición consolidada por empresa, banco y divisa, sin exportar ni cuadrar a mano.'],
            ['Riesgo a la vista', 'Deuda, contrapartes y comportamiento de pago con avisos antes de que haya un problema.'],
            ['Cierre de mes más rápido', 'Conciliación automática de movimientos, facturas y asientos con tu ERP.'],
            ['Todos los pagos, un sitio', 'Prepara, aprueba y ejecuta remesas en cualquiera de tus bancos.'],
          ].map(([t, d], i) => (
            <article key={t} className="lp-card reveal" style={{ animationDelay: `${i * 70}ms` }}>
              <h3>{t}</h3>
              <p>{d}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section" id="conectamos">
        <h2 className="lp-h2">Conectamos lo que ya tienes</h2>
        <p className="lp-sub">
          Bancos y ERP de las empresas de esta demo, tal como llegan a Embat.
          {portfolio.data && ` ${nf(portfolio.data.rows.length)} empresas conectadas.`}
        </p>
        <div className="lp-grid-2">
          <article className="lp-card">
            <h3>Tus bancos, en una pantalla</h3>
            <p>Conexión directa con cada entidad: saldos, movimientos, financiación y pagos.</p>
            <ul className="lp-chips">
              {bancos.map((b) => <li key={b.name}>{b.name}<span>{nf(b.companies)}</span></li>)}
              {providers.loading && <li className="muted">Cargando…</li>}
            </ul>
          </article>
          <article className="lp-card">
            <h3>Tu ERP, en los dos sentidos</h3>
            <p>Facturas de cobro y de pago entran solas; lo conciliado vuelve al ERP sin cargas manuales.</p>
            <ul className="lp-chips">
              {erps.map(([n, c]) => <li key={n}>{n}<span>{nf(c)}</span></li>)}
              {portfolio.loading && <li className="muted">Cargando…</li>}
            </ul>
          </article>
        </div>
      </section>

      <section className="lp-band">
        <div className="lp-band-in">
          <TellMeLogo size={56} className="lp-band-logo" />
          <h2><TellMeWordmark />, la IA de Embat</h2>
          <p>
            Lee los mismos datos que tú y te los cuenta en español: qué ha cambiado este mes,
            por qué, y qué conviene mirar primero. Y le puedes preguntar.
          </p>
        </div>
      </section>

      <section className="lp-section">
        <a href="#/xray" className="lp-feature reveal">
          <span className="lp-eyebrow">Nuevo</span>
          <h2><span className="product">X-Ray</span> La salud financiera de cada empresa, mes a mes</h2>
          <p>
            Con los movimientos, las facturas y la deuda que Embat ya tiene, X-Ray pone una nota
            a cada empresa todos los meses y avisa cuando empieza a torcerse.
          </p>
          <ul className="lp-feature-list">
            <li><strong>Cómo está</strong> Una salud de 0 a 100, comparable entre empresas del mismo tamaño.</li>
            <li><strong>Hacia dónde va</strong> Si mejora o empeora, y una proyección a seis meses con su margen.</li>
            <li><strong>Qué hacer</strong> Qué le está restando puntos y qué palanca lo corrige, con el efecto estimado.</li>
          </ul>
          <span className="lp-btn lp-btn-primary">Descubre X-Ray</span>
        </a>
      </section>

      <footer className="lp-foot">
        <span className="logo" aria-hidden="true" />
        <span className="muted">Demo de HackSpain 2026 con datos sintéticos.</span>
      </footer>
    </div>
  )
}

/** Presentación de la demo: qué es X-Ray en tres frases y un botón para entrar. */
export function XRayLanding() {
  const ev = useAsync(() => getEvidence(), [])
  const portfolio = useAsync(() => getPortfolio(), [])
  const e = ev.data
  const pct = (v: number) => `${Math.round(v * 100)} %`

  return (
    <div className="lp">
      <TopNav />
      <section className="lp-hero lp-hero-xray">
        <div className="lp-hero-in">
          <p className="lp-eyebrow reveal">Embat · Nuevo</p>
          <h1 className="lp-xray reveal"><span className="product">X-Ray</span></h1>
          <p className="lp-lead reveal">
            Lee la tesorería de cada empresa y te dice cómo está, hacia dónde va y qué hacer.
          </p>
          <div className="lp-actions reveal">
            <a href="#/app" className="lp-btn lp-btn-primary lp-btn-lg">Entrar a la demo</a>
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-grid-3">
          <article className="lp-card reveal">
            <span className="lp-num">0 a 100</span>
            <h3>Una salud, cada mes</h3>
            <p>Un número por empresa que mira pagos, cobros, caja y deuda. Y su trayectoria, no solo la foto.</p>
          </article>
          <article className="lp-card reveal" style={{ animationDelay: '70ms' }}>
            <span className="lp-num">{e ? pct(e.bothDirections.slippingRecall) : '…'}</span>
            <h3>Avisa antes</h3>
            {/* En una sola cadena: partirlo en dos deja un espacio antes del punto mientras carga. */}
            <p>
              {e
                ? `de los deterioros reales se vieron venir, con ${e.anticipation.medianMonths} meses de margen de mediana.`
                : 'de los deterioros reales se vieron venir, con meses de margen.'}
            </p>
          </article>
          <article className="lp-card reveal" style={{ animationDelay: '140ms' }}>
            <span className="lp-num"><TellMeLogo size={34} /></span>
            <h3>Explica cada cambio</h3>
            <p>TellMe cuenta en lenguaje llano por qué se mueve el número y qué palanca lo corrige.</p>
          </article>
        </div>
        {portfolio.data && (
          <p className="lp-stats reveal">
            {nf(portfolio.data.rows.length)} empresas analizadas con los 24 meses de tesorería que
            Embat ya tiene. Nadie rellena un formulario ni manda un balance.
          </p>
        )}
        <div className="lp-actions lp-center">
          <a href="#/app" className="lp-btn lp-btn-primary lp-btn-lg">Entrar a la demo</a>
          <a href="#/" className="lp-btn lp-btn-ghost-dark">Volver a Embat</a>
        </div>
      </section>
    </div>
  )
}
