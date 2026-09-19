import { getPortfolio } from '../api'
import { useAsync } from '../shared/useAsync'
import { ErrorNotice, Skeleton } from '../shared/States'
import { Monitor } from './Monitor'
import { PortfolioTable } from './PortfolioTable'
import './portfolio.css'

export function PortfolioView({ onSelect }: { onSelect: (id: string) => void }) {
  const { data, error, loading } = useAsync(() => getPortfolio(), [])

  if (loading) return <Skeleton height="26rem" />
  if (error) return <ErrorNotice error={error} />
  if (!data) return null

  const c = data.counts
  return (
    <>
      <h2>Se han movido solas</h2>
      <Monitor onSelect={onSelect} />

      <h2>Las {data.rows.length.toLocaleString('es-ES')} empresas</h2>
      <div className="counts">
        <div className="count"><strong>{c.healthy}</strong><span>Sanas</span></div>
        <div className="count"><strong>{c.stable}</strong><span>Estables</span></div>
        <div className="count"><strong>{c.risk}</strong><span>En riesgo</span></div>
        <div className="count"><strong>{c.improving}</strong><span>Mejorando</span></div>
        <div className="count"><strong>{c.slipping}</strong><span>Torciéndose</span></div>
        <div className="count"><strong>{c.heldOut}</strong><span>Test oculto</span></div>
      </div>

      <PortfolioTable rows={data.rows} onSelect={onSelect} />
    </>
  )
}
