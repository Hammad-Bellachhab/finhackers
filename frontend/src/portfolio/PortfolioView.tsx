import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { getPortfolio } from '../api'
import type { PortfolioMonth } from '../api/types'
import { HEALTH_BAND_COLOR, Panel, axis, monthAxis, tooltip } from '../shared/charts'
import { useAsync } from '../shared/useAsync'
import { ErrorNotice, Skeleton } from '../shared/States'
import { TellMeCard } from '../shared/TellMeCard'
import { PortfolioTable } from './PortfolioTable'
import './portfolio.css'

function Evolution({ history }: { history: PortfolioMonth[] }) {
  const bands: [keyof PortfolioMonth, string][] = [['risk', 'riesgo'], ['watch', 'vigilar'], ['healthy', 'sana'], ['solid', 'sólida']]
  return (
    <Panel title="Evolución de la cartera">
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={history} margin={{ top: 8, right: 0, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis {...monthAxis} />
          <YAxis yAxisId="n" {...axis} />
          <YAxis yAxisId="h" orientation="right" domain={[50, 100]} {...axis} />
          <Tooltip {...tooltip} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {bands.map(([k, name]) => (
            <Bar key={k} yAxisId="n" dataKey={k} name={name} stackId="b" fill={HEALTH_BAND_COLOR[name]} stroke="var(--color-bg)" strokeWidth={1} isAnimationActive={false} />
          ))}
          <Line yAxisId="h" dataKey="meanHealth" name="Salud media" stroke="var(--chart-1)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </Panel>
  )
}

export function PortfolioView({
  onSelect, comparar, onComparar,
}: { onSelect: (id: string) => void; comparar?: string[]; onComparar?: (id: string) => void }) {
  return <><TellMeCard /><Cartera onSelect={onSelect} comparar={comparar} onComparar={onComparar} /></>
}

function Cartera({
  onSelect, comparar, onComparar,
}: { onSelect: (id: string) => void; comparar?: string[]; onComparar?: (id: string) => void }) {
  const { data, error, loading } = useAsync(() => getPortfolio(), [])

  if (loading) return <Skeleton height="26rem" />
  if (error) return <ErrorNotice error={error} />
  if (!data) return null

  const c = data.counts
  return (
    <>
      <h2>Las {data.rows.length.toLocaleString('es-ES')} empresas{data.month && ` · ${data.month}`}</h2>
      <div className="counts">
        <div className="count"><strong>{c.healthy}</strong><span>Sanas</span></div>
        <div className="count"><strong>{c.stable}</strong><span>Estables</span></div>
        <div className="count"><strong>{c.risk}</strong><span>En riesgo</span></div>
        <div className="count"><strong>{c.improving}</strong><span>Mejorando</span></div>
        <div className="count"><strong>{c.slipping}</strong><span>Torciéndose</span></div>
      </div>
      {data.history && (
        <>
          <Evolution history={data.history} />
        </>
      )}

      <h2>Detalle</h2>
      <PortfolioTable rows={data.rows} onSelect={onSelect} comparar={comparar} onComparar={onComparar} />
    </>
  )
}
