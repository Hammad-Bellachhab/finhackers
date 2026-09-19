import { useMemo, useState } from 'react'
import type { Provider, ProviderKind } from '../api/types'
import { formatMoney } from '../shared/format'
import { Gauge } from '../shared/Gauge'
import { Empty } from '../shared/States'
import { BandBar, CompanyCard, KIND_LABEL, KindBadge, tipos } from './parts'
import '../portfolio/portfolio.css'
import './providers.css'

type Orden = 'empresas' | 'riesgo' | 'salud' | 'deuda' | 'torciendose'

const ORDEN: Record<Orden, [string, (a: Provider, b: Provider) => number]> = {
  empresas: ['Más empresas conectadas', (a, b) => b.companies - a.companies],
  // Por cuántas, no por porcentaje: media cartera son bancos de una sola empresa y un 100 % ahí no dice nada.
  riesgo: ['Más empresas en riesgo', (a, b) => b.bands.riesgo - a.bands.riesgo || b.riskShare - a.riskShare],
  torciendose: ['Más empresas torciéndose', (a, b) => b.slipping - a.slipping],
  salud: ['Peor salud media', (a, b) => a.meanHealth - b.meanHealth],
  deuda: ['Mayor saldo vivo', (a, b) => b.outstanding - a.outstanding],
}

/** Cuántas empresas se pintan de golpe al desplegar un proveedor: Santander tiene 433. */
const PRIMERAS = 24

/** Corte del chip que aparta la cola larga de bancos con una o dos empresas. */
const RELEVANTE = 10

function ProviderRow({ p, onSelect }: { p: Provider; onSelect: (id: string) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [todas, setTodas] = useState(false)
  const [q, setQ] = useState('')

  const buscando = q.trim().length > 0
  const encontradas = useMemo(() => {
    if (!buscando) return p.rows
    const t = q.trim().toLowerCase()
    return p.rows.filter((r) => r.name.toLowerCase().includes(t) || r.companyId.toLowerCase().includes(t))
  }, [p.rows, q, buscando])
  // Buscando, se enseñan todos los resultados: es lo que se busca, no tiene sentido recortarlos a 24.
  const visibles = buscando ? encontradas : (todas ? p.rows : p.rows.slice(0, PRIMERAS))

  return (
    <>
      <tr className={abierto ? 'provider-row provider-open' : 'provider-row'}>
        <td>
          <button
            type="button" className="provider-toggle" aria-expanded={abierto}
            onClick={() => setAbierto((v) => !v)}
          >
            <span className="provider-caret" aria-hidden="true">{abierto ? '▾' : '▸'}</span>
            <span>
              <strong>{p.name}</strong> <KindBadge kind={p.kind} />
              <span className="provider-services">{p.services.join(' · ')}</span>
            </span>
          </button>
        </td>
        <td className="num">{p.companies.toLocaleString('es-ES')}</td>
        <td className="num">{p.products.toLocaleString('es-ES')}</td>
        <td className="muted">{tipos(p.types)}</td>
        <td><Gauge score={p.meanHealth} label="salud media de sus empresas" /></td>
        <td className="provider-bands">
          <BandBar bands={p.bands} total={p.companies} />
          <span className="muted">{Math.round(100 * p.riskShare)} % en riesgo</span>
        </td>
        <td className="num">{p.slipping.toLocaleString('es-ES')}</td>
        <td className="num">{p.outstanding > 0 ? formatMoney(p.outstanding, true) : '—'}</td>
      </tr>
      {abierto && (
        <tr className="provider-detail">
          <td colSpan={8}>
            <p className="muted">
              Las {p.companies.toLocaleString('es-ES')} empresas conectadas por {p.name}, de menos a más salud.
            </p>
            {p.rows.length > PRIMERAS && (
              <div className="filters filters-form">
                <input
                  type="search" aria-label={`Buscar empresa en ${p.name}`} placeholder="Buscar empresa…"
                  value={q} onChange={(e) => setQ(e.target.value)}
                />
                {buscando && (
                  <span className="muted">
                    {encontradas.length.toLocaleString('es-ES')} de {p.rows.length.toLocaleString('es-ES')}
                  </span>
                )}
              </div>
            )}
            {buscando && encontradas.length === 0 ? (
              <p className="muted">Ninguna empresa de {p.name} coincide con la búsqueda.</p>
            ) : (
              <div className="provider-companies">
                {visibles.map((r) => <CompanyCard key={r.companyId} row={r} onSelect={onSelect} />)}
              </div>
            )}
            {!buscando && p.rows.length > PRIMERAS && (
              <button type="button" className="chip" onClick={() => setTodas((v) => !v)}>
                {todas ? 'Ver solo las primeras' : `Ver las ${p.rows.length.toLocaleString('es-ES')}`}
              </button>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

export function ProvidersTable({
  providers, onSelect,
}: { providers: Provider[]; onSelect: (id: string) => void }) {
  const [orden, setOrden] = useState<Orden>('empresas')
  const [q, setQ] = useState('')
  const [soloFinanciacion, setSoloFinanciacion] = useState(false)
  const [soloRelevantes, setSoloRelevantes] = useState(false)
  const [tipo, setTipo] = useState<ProviderKind | ''>('')

  const kinds = useMemo(() => {
    const n = new Map<ProviderKind, number>()
    for (const p of providers) n.set(p.kind, (n.get(p.kind) ?? 0) + 1)
    return [...n].sort((a, b) => b[1] - a[1])
  }, [providers])

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase()
    return providers
      .filter((p) => !tipo || p.kind === tipo)
      .filter((p) => !soloRelevantes || p.companies >= RELEVANTE)
      .filter((p) => !soloFinanciacion || p.outstanding > 0)
      .filter((p) => !t || p.name.toLowerCase().includes(t) || p.services.some((s) => s.toLowerCase().includes(t)))
      .slice()
      .sort(ORDEN[orden][1])
  }, [providers, orden, q, soloFinanciacion, soloRelevantes, tipo])

  return (
    <>
      <div className="filters filters-form">
        <select aria-label="Ordenar por" value={orden} onChange={(e) => setOrden(e.target.value as Orden)}>
          {Object.entries(ORDEN).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <select aria-label="Tipo de proveedor" value={tipo} onChange={(e) => setTipo(e.target.value as ProviderKind | '')}>
          <option value="">Todos los tipos</option>
          {kinds.map(([k, n]) => <option key={k} value={k}>{KIND_LABEL[k]} ({n})</option>)}
        </select>
        <button
          type="button" className={soloFinanciacion ? 'chip chip-on' : 'chip'}
          aria-pressed={soloFinanciacion} onClick={() => setSoloFinanciacion((v) => !v)}
        >
          Solo con financiación
        </button>
        <button
          type="button" className={soloRelevantes ? 'chip chip-on' : 'chip'}
          aria-pressed={soloRelevantes} onClick={() => setSoloRelevantes((v) => !v)}
        >
          Desde {RELEVANTE} empresas
        </button>
        <input
          type="search" aria-label="Buscar proveedor o conector" placeholder="Buscar banco o conector…"
          value={q} onChange={(e) => setQ(e.target.value)}
        />
        <span className="muted">{filtrados.length.toLocaleString('es-ES')} proveedores</span>
      </div>

      {filtrados.length === 0 ? (
        <Empty message="Ningún proveedor cumple ese filtro." />
      ) : (
        <div className="table-scroll">
          <table className="portfolio providers">
            <thead>
              <tr>
                <th>Proveedor · conector</th>
                <th>Empresas</th><th>Productos</th><th>Qué tiene colocado</th>
                <th>Salud media</th><th>Reparto</th><th>Torciéndose</th><th>Saldo vivo</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => <ProviderRow key={p.name} p={p} onSelect={onSelect} />)}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
