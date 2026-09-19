import type { HealthBand, ProductCount, ProviderCompany } from '../api/types'
import { HEALTH_BAND_COLOR } from '../shared/charts'
import { Delta } from '../shared/Delta'
import { formatMoney } from '../shared/format'
import { Gauge } from '../shared/Gauge'
import { TrendArrow } from '../shared/TrendArrow'
import './providers.css'

/** Nombre llano de cada tipo de producto: en pantalla no cabe el término del ERP. */
const TIPO: Record<string, string> = {
  checking: 'cuenta', card: 'tarjeta', investment: 'inversión', wallet: 'monedero',
  tpv: 'TPV', risk: 'riesgo', expensesPlatform: 'gastos', lineofcomex: 'comex', saving: 'ahorro',
  loan: 'préstamo', lineofcredit: 'línea de crédito', confirming: 'confirming', leasing: 'leasing',
  guarantee: 'aval', mortgage: 'hipoteca', renting: 'renting', factoring: 'factoring',
}

export const BANDAS: HealthBand[] = ['riesgo', 'vigilar', 'sana', 'sólida']

export function tipos(items: ProductCount[], max = 3): string {
  const shown = items.slice(0, max).map((t) => `${t.n} ${TIPO[t.type] ?? t.type}`)
  const resto = items.length - shown.length
  return [...shown, resto > 0 ? `+${resto}` : ''].filter(Boolean).join(' · ')
}

/** Reparto de las empresas de un proveedor por banda, en una barra de 100 %. */
export function BandBar({ bands, total }: { bands: Record<HealthBand, number>; total: number }) {
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

/** Una empresa vista desde su proveedor: velocímetro, puntuación y qué tiene contratado. */
export function CompanyCard({ row, onSelect }: { row: ProviderCompany; onSelect: (id: string) => void }) {
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
