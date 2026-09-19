import { useMemo, useState } from 'react'
import { getProviders } from '../api'
import type { Provider, Providers } from '../api/types'
import { formatMoney } from '../shared/format'
import { Gauge } from '../shared/Gauge'
import { ErrorNotice, Skeleton } from '../shared/States'
import { useAsync } from '../shared/useAsync'
import { KindBadge, tipos } from './parts'
import './providers.css'

/** Empresas que aparecen en el selector, con su nombre. Solo salen las que tienen
 *  algún producto conectado: sin banco no hay nada que enseñar. */
export function companyIndex(data: Providers): { id: string; name: string }[] {
  const nombres = new Map<string, string>()
  for (const p of data.providers) for (const r of p.rows) nombres.set(r.companyId, r.name)
  return [...nombres].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

/** La relación va en un solo sentido: esta empresa y lo que tiene con este proveedor.
 *  El medidor NO es la salud de la empresa (esa es la misma en todas las tarjetas y ya sale
 *  arriba en "Su salud"): es la salud media de la cartera del proveedor, que sí distingue
 *  a un banco de otro. Quién compone esa cartera es cosa de la vista global. */
function ProviderCard({ p, companyId }: { p: Provider; companyId: string }) {
  const yo = p.rows.find((r) => r.companyId === companyId)!

  return (
    <section className="panel provider-card">
      <header className="provider-card-head">
        <div>
          <h3>{p.name} <KindBadge kind={p.kind} /></h3>
          <p className="provider-services">{p.services.join(' · ')}</p>
        </div>
        <div className="provider-card-mean">
          <Gauge score={p.meanHealth} size="md" label={`salud media de las ${p.companies} empresas de ${p.name}`} />
          <span>salud media de su cartera</span>
        </div>
      </header>

      <dl className="provider-card-facts">
        <div><dt>Tiene contratado</dt><dd>{tipos(yo.types, 4)}</dd></div>
        <div><dt>Saldo vivo</dt><dd>{yo.outstanding > 0 ? formatMoney(yo.outstanding, true) : '—'}</dd></div>
        <div><dt>Concedido</dt><dd>{yo.granted > 0 ? formatMoney(yo.granted, true) : '—'}</dd></div>
      </dl>
    </section>
  )
}

/** Buscador nativo (datalist): nombre o ID, sin librerías. Igual que el de Empresa: empieza
 *  vacío y se vacía otra vez al elegir, no enseña la empresa activa. */
function CompanyPicker({
  empresas, onSelect,
}: { empresas: { id: string; name: string }[]; onSelect: (id: string) => void }) {
  const [q, setQ] = useState('')

  const pick = (v: string) => {
    setQ(v)
    const hit = empresas.find((c) => c.id === v || `${c.name} · ${c.id}` === v)
    if (hit) { onSelect(hit.id); setQ('') }
  }

  return (
    <div className="filters filters-form">
      <label htmlFor="empresa-proveedores">Empresa</label>
      <input
        id="empresa-proveedores" list="empresas-proveedores"
        value={q} placeholder="Busca por nombre o ID…"
        onChange={(e) => pick(e.target.value)}
      />
      <datalist id="empresas-proveedores">
        {empresas.map((c) => <option key={c.id} value={`${c.name} · ${c.id}`} />)}
      </datalist>
    </div>
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
      <CompanyPicker empresas={empresas} onSelect={onSelect} />

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
            de gastos o tarjetas. La cartera de cada proveedor se mira en Global › Proveedores.
          </p>
          {mios.map((p) => <ProviderCard key={p.name} p={p} companyId={companyId} />)}
        </>
      )}
    </>
  )
}
