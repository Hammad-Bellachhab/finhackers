import { useMemo, useState } from 'react'
import { getProviders } from '../api'
import type { Provider, ProviderCompany, Providers } from '../api/types'
import { formatMoney } from '../shared/format'
import { Gauge } from '../shared/Gauge'
import { ErrorNotice, Skeleton } from '../shared/States'
import { useAsync } from '../shared/useAsync'
import { BandBar, CompanyCard, KindBadge, tipos } from './parts'
import './providers.css'

/** Cuántas empresas del banco se enseñan antes de pedir el resto. */
const PRIMERAS = 12

/** Empresas que aparecen en el selector, con su nombre. Solo salen las que tienen
 *  algún producto conectado: sin banco no hay nada que enseñar. */
export function companyIndex(data: Providers): { id: string; name: string }[] {
  const nombres = new Map<string, string>()
  for (const p of data.providers) for (const r of p.rows) nombres.set(r.companyId, r.name)
  return [...nombres].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

/** Posición de la empresa dentro de la cartera de su banco, en percentil de salud.
 *  0 % = la peor del banco. Sirve para responder "¿soy yo el problema o lo es el sector?". */
export function percentile(rows: ProviderCompany[], companyId: string): number {
  const yo = rows.find((r) => r.companyId === companyId)
  if (!yo || rows.length < 2) return 0
  const peores = rows.filter((r) => r.score < yo.score).length
  return Math.round((100 * peores) / (rows.length - 1))
}

function ProviderCard({
  p, companyId, onSelect,
}: { p: Provider; companyId: string; onSelect: (id: string) => void }) {
  const [todas, setTodas] = useState(false)
  const yo = p.rows.find((r) => r.companyId === companyId)!
  const otras = p.rows.filter((r) => r.companyId !== companyId)
  const visibles = todas ? otras : otras.slice(0, PRIMERAS)
  const pct = percentile(p.rows, companyId)

  return (
    <section className="panel provider-card">
      <header className="provider-card-head">
        <div>
          <h3>{p.name} <KindBadge kind={p.kind} /></h3>
          <p className="provider-services">{p.services.join(' · ')}</p>
        </div>
        <Gauge score={yo.score} band={yo.healthBand} size="md" label={`banda ${yo.healthBand}`} />
      </header>

      <dl className="provider-card-facts">
        <div><dt>Tiene contratado</dt><dd>{tipos(yo.types, 4)}</dd></div>
        <div><dt>Saldo vivo</dt><dd>{yo.outstanding > 0 ? formatMoney(yo.outstanding, true) : '—'}</dd></div>
        <div><dt>Concedido</dt><dd>{yo.granted > 0 ? formatMoney(yo.granted, true) : '—'}</dd></div>
        <div>
          <dt>Su sitio aquí</dt>
          <dd>
            {otras.length === 0
              ? 'única empresa conectada'
              : `mejor que el ${pct} % de sus ${p.companies.toLocaleString('es-ES')} empresas`}
          </dd>
        </div>
      </dl>

      {otras.length > 0 && (
        <>
          <p className="provider-card-bands">
            <BandBar bands={p.bands} total={p.companies} />
            <span className="muted">
              Cartera del proveedor: {p.bands.riesgo} en riesgo · {p.bands.vigilar} a vigilar ·
              {' '}{p.bands.sana + p.bands['sólida']} sanas o sólidas · salud media {p.meanHealth.toLocaleString('es-ES')}
            </span>
          </p>
          <div className="provider-companies">
            {visibles.map((r) => <CompanyCard key={r.companyId} row={r} onSelect={onSelect} />)}
          </div>
          {otras.length > PRIMERAS && (
            <button type="button" className="chip" onClick={() => setTodas((v) => !v)}>
              {todas ? 'Ver solo las primeras' : `Ver las ${otras.length.toLocaleString('es-ES')}`}
            </button>
          )}
        </>
      )}
    </section>
  )
}

export function CompanyProvidersView({
  companyId, onSelect,
}: { companyId: string; onSelect: (id: string) => void }) {
  const { data, error, loading } = useAsync(() => getProviders(), [])
  const empresas = useMemo(() => (data ? companyIndex(data) : []), [data])

  if (loading) return <Skeleton height="26rem" />
  if (error) return <ErrorNotice error={error} />
  if (!data) return null

  const mios = data.providers.filter((p) => p.rows.some((r) => r.companyId === companyId))
  const yo = mios[0]?.rows.find((r) => r.companyId === companyId)
  const productos = mios.reduce((n, p) => n + (p.rows.find((r) => r.companyId === companyId)?.products ?? 0), 0)
  const vivo = mios.reduce((n, p) => n + (p.rows.find((r) => r.companyId === companyId)?.outstanding ?? 0), 0)

  return (
    <>
      <h2>Proveedores del cliente{data.month && ` · ${data.month}`}</h2>
      <div className="filters filters-form">
        <label htmlFor="empresa-proveedores">Empresa</label>
        <select
          id="empresa-proveedores" value={companyId}
          onChange={(e) => onSelect(e.target.value)}
        >
          {empresas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {mios.length === 0 ? (
        <p className="empty">Esta empresa no tiene ningún producto conectado.</p>
      ) : (
        <>
          <div className="counts">
            <div className="count"><strong>{mios.length}</strong><span>Proveedores</span></div>
            <div className="count"><strong>{productos}</strong><span>Productos conectados</span></div>
            <div className="count"><strong>{vivo > 0 ? formatMoney(vivo, true) : '—'}</strong><span>Saldo vivo</span></div>
            {yo && <div className="count"><strong>{yo.score}</strong><span>Su salud</span></div>}
          </div>
          <p className="muted legend-line">
            Con quién trabaja y qué tiene con cada uno: bancos, pero también pasarelas de pago, plataformas
            de gastos o tarjetas. Debajo de cada uno, las demás empresas que ese proveedor tiene conectadas.
          </p>
          {mios.map((p) => (
            <ProviderCard key={p.name} p={p} companyId={companyId} onSelect={onSelect} />
          ))}
        </>
      )}
    </>
  )
}
