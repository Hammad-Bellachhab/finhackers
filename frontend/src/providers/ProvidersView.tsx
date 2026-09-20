import { getProviders } from '../api'
import { ErrorNotice, Skeleton } from '../shared/States'
import { useAsync } from '../shared/useAsync'
import { ProvidersTable } from './ProvidersTable'
import './providers.css'

export function ProvidersView({ onSelect }: { onSelect: (id: string) => void }) {
  const { data, error, loading } = useAsync(() => getProviders(), [])

  if (loading) return <Skeleton height="26rem" />
  if (error) return <ErrorNotice error={error} />
  if (!data) return null

  const t = data.totals
  const enRiesgo = data.providers.filter((p) => p.companies >= 10 && p.riskShare >= 0.15).length
  return (
    <>
      <h2>Proveedores{data.month && ` · ${data.month}`}</h2>
      <div className="counts">
        <div className="count"><strong>{t.providers}</strong><span>Proveedores</span></div>
        <div className="count"><strong>{t.connectors}</strong><span>Conectores</span></div>
        <div className="count"><strong>{t.products.toLocaleString('es-ES')}</strong><span>Productos conectados</span></div>
        <div className="count"><strong>{t.companies.toLocaleString('es-ES')}</strong><span>Empresas</span></div>
        <div className="count"><strong>{enRiesgo}</strong><span>Con ≥ 15 % en riesgo</span></div>
      </div>
      <ProvidersTable providers={data.providers} onSelect={onSelect} />
    </>
  )
}
