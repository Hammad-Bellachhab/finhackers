import { useMemo, useState } from 'react'
import type { HealthBand, ProductCount, Provider, ProviderCompany } from '../api/types'
import { HEALTH_BAND_COLOR } from '../shared/charts'
import { Delta } from '../shared/Delta'
import { formatMoney } from '../shared/format'
import { Gauge } from '../shared/Gauge'
import { Empty } from '../shared/States'
import { TrendArrow } from '../shared/TrendArrow'
import '../portfolio/portfolio.css'
import './providers.css'

/** Nombre llano de cada tipo de producto: en pantalla no cabe el término del ERP. */
const TIPO: Record<string, string> = {
  checking: 'cuenta', card: 'tarjeta', investment: 'inversión', wallet: 'monedero',
  tpv: 'TPV', risk: 'riesgo', expensesPlatform: 'gastos', lineofcomex: 'comex', saving: 'ahorro',
  loan: 'préstamo', lineofcredit: 'línea de crédito', confirming: 'confirming', leasing: 'leasing',
  guarantee: 'aval', mortgage: 'hipoteca', renting: 'renting', factoring: 'factoring',
}

const BANDAS: HealthBand[] = ['riesgo', 'vigilar', 'sana', 'sólida']

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

export function tipos(items: ProductCount[], max = 3): string {
  const shown = items.slice(0, max).map((t) => `${t.n} ${TIPO[t.type] ?? t.type}`)
  const resto = items.length - shown.length
  return [...shown, resto > 0 ? `+${resto}` : ''].filter(Boolean).join(' · ')
}

/** Reparto de las empresas del proveedor por banda, en una barra de 100 %. */
function BandBar({ bands, total }: { bands: Record<HealthBand, number>; total: number }) {
  return (
    <span className="bandbar" role="img" aria-label={BANDAS.map((b) => `${bands[b] ?? 0} ${b}`).join(', ')}>
      {BANDAS.map((b) => {
        const n = bands[b] ?? 0
        if (n === 0) return null
        return (
          <span
            key={b} title={`${n} ${b}`}
            style={{ width: `${(100 * n) / total}%`, background: HEALTH_BAND_COLOR[b] }}
          />
        )
      })}
    </span>
  )
}

/** Una empresa del proveedor: su velocímetro, su puntuación y qué tiene contratado. */
function CompanyCard({ row, onSelect }: { row: ProviderCompany; onSelect: (id: string) => void }) {
  return (
    <button type="button" className="provider-company" onClick={() => onSelect(row.companyId)}>
      <Gauge score={row.score} band={row.healthBand} label={`banda ${row.healthBand}`} />
      <span className="provider-company-body">
        <span className="provider-company-name">{row.name}</span>
        <span className="provider-company-meta">
          {row.healthBand} <TrendArrow trend={row.trend} /> · <Delta value={row.delta3m} /> en 3 m
        </span>
        <span className="provider-company-meta muted">
          {tipos(row.types, 2)}
          {row.outstanding > 0 && ` · ${formatMoney(row.outstanding, true)} vivos`}
        </span>
      </span>
    </button>
  )
}

function ProviderRow({ p, onSelect }: { p: Provider; onSelect: (id: string) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [todas, setTodas] = useState(false)
  const visibles = todas ? p.rows : p.rows.slice(0, PRIMERAS)

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
              <strong>{p.name}</strong>
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
            <div className="provider-companies">
              {visibles.map((r) => <CompanyCard key={r.companyId} row={r} onSelect={onSelect} />)}
            </div>
            {p.rows.length > PRIMERAS && (
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

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase()
    return providers
      .filter((p) => !soloRelevantes || p.companies >= RELEVANTE)
      .filter((p) => !soloFinanciacion || p.outstanding > 0)
      .filter((p) => !t || p.name.toLowerCase().includes(t) || p.services.some((s) => s.toLowerCase().includes(t)))
      .slice()
      .sort(ORDEN[orden][1])
  }, [providers, orden, q, soloFinanciacion, soloRelevantes])

  return (
    <>
      <div className="filters filters-form">
        <select aria-label="Ordenar por" value={orden} onChange={(e) => setOrden(e.target.value as Orden)}>
          {Object.entries(ORDEN).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
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
