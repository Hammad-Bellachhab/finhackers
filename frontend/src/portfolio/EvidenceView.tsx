import { useMemo } from 'react'
import { getAlerts, getEvidence } from '../api'
import type { Alert } from '../api/types'
import { Panel } from '../shared/charts'
import { ErrorNotice, Skeleton } from '../shared/States'
import { formatPct } from '../shared/format'
import { useAsync } from '../shared/useAsync'
import './portfolio.css'

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="count">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

/** La que sigue pareciendo sana pero ya cae: el caso Velasco del brief, con una empresa real
 *  de la cartera en vez del ejemplo de manual. */
function sanaPeroCayendo(alerts: Alert[]): Alert | null {
  const candidatas = alerts.filter((a) => a.kind === 'slipping' && a.score >= 75)
  return candidatas.sort((a, b) => b.score - a.score)[0] ?? null
}

/** El caso con más margen de antelación entre las que sí se torcieron. */
function mayorAntelacion(alerts: Alert[]): Alert | null {
  const candidatas = alerts.filter((a) => a.kind === 'slipping' && a.monthsAhead != null)
  return candidatas.sort((a, b) => (b.monthsAhead ?? 0) - (a.monthsAhead ?? 0))[0] ?? null
}

/** La rúbrica del brief (docs/reto-embat.md · "Cómo se evalúa"), medida y en pantalla: tres
 *  bloques con el mismo peso. Casi todos los equipos dejan esto en un slide; enseñarlo en
 *  vivo es barato y vale un tercio de la nota. */
export function EvidenceView() {
  const evidence = useAsync(() => getEvidence(), [])
  const alerts = useAsync(() => getAlerts(), [])

  const sana = useMemo(() => (alerts.data ? sanaPeroCayendo(alerts.data) : null), [alerts.data])
  const rapida = useMemo(() => (alerts.data ? mayorAntelacion(alerts.data) : null), [alerts.data])

  if (evidence.loading) return <Skeleton height="30rem" />
  if (evidence.error) return <ErrorNotice error={evidence.error} />
  const data = evidence.data
  if (!data) return null

  return (
    <>
      <h2>Cómo se evalúa esto</h2>
      <p className="muted legend-line">
        Tres bloques, el mismo peso. Lo de abajo es la prueba, no la promesa: cifras del motor real, sobre
        empresas que nunca vio entrenar.
      </p>

      <Panel
        title="Acierta"
        note="Generaliza a empresas no vistas, sigue la trayectoria (no solo el nivel) y detecta la mejora igual que el deterioro."
      >
        <div className="counts">
          <Stat value={String(data.holdout.companies)} label="Empresas no vistas nunca" />
          <Stat value={data.holdout.auc.toFixed(2)} label="AUC en holdout" />
          <Stat value={data.holdout.spearman.toFixed(2)} label="Correlación de orden" />
          <Stat value={formatPct(data.bothDirections.improvingRecall)} label="Detecta la mejora" />
          <Stat value={formatPct(data.bothDirections.slippingRecall)} label="Detecta el deterioro" />
        </div>
        {sana && (
          <p className="legend-line muted panel-footnote">
            <strong>{sana.companyName}</strong> tiene {Math.round(sana.score)} de salud — sigue pareciendo
            sana — y ya la marcamos cayendo {Math.abs(sana.delta).toFixed(0)} puntos en 3 meses. Es el caso
            Velasco del brief, con nombre real de la cartera.
          </p>
        )}
      </Panel>

      <Panel
        title="Llega a tiempo"
        note="Anticipa con meses de margen, medidos. Distingue el bache puntual del deterioro real. Avisa solo, sin que nadie pregunte."
      >
        <div className="counts">
          <Stat value={String(data.anticipation.medianMonths)} label="Meses de antelación (mediana)" />
          <Stat value={`${data.anticipation.p25}–${data.anticipation.p75}`} label="Rango intercuartílico" />
          <Stat value={String(data.anticipation.detected)} label="Casos con detección previa" />
          <Stat value={String(data.stability.dipsCorrectlyIgnored)} label="Baches no confundidos" />
          <Stat value={String(data.stability.structuralCaught)} label="Deterioros reales detectados" />
          {alerts.data && (
            <Stat value={String(alerts.data.length)} label="Empresas marcadas este mes, sin preguntar" />
          )}
        </div>
        {rapida && (
          <p className="legend-line muted panel-footnote">
            El caso con más margen: a <strong>{rapida.companyName}</strong> la vimos caer{' '}
            <strong>{rapida.monthsAhead} meses</strong> antes de que fuera evidente.
          </p>
        )}
      </Panel>

      <Panel title="Vale algo" note="Producto, comprador, explicación.">
        <p className="pull-quote">
          De la foto al pulso. De castigar a premiar. Del corte de grifo al aviso. Del banco que juzga a la
          empresa que se enseña.
        </p>
        <ul className="value-cards">
          <li>
            <h4>Producto</h4>
            <p>
              <strong>Pulso Crédito</strong>, la línea de crédito que respira: límite y precio recalculados
              cada mes con salud y trayectoria, no revisados una vez al año.
            </p>
          </li>
          <li>
            <h4>Comprador</h4>
            <p>
              El prestamista paga el motor: ve riesgo real, no un dossier de hace seis meses. La pyme
              comparte su score —nunca sus movimientos— y a cambio saca crédito más barato y un aviso antes
              del recorte, no un corte de grifo.
            </p>
          </li>
          <li>
            <h4>Explicación</h4>
            <p>
              Cada score trae sus señales dominantes y desde cuándo se mueven (pestaña Empresa, "Qué lo ha
              movido"). Nada de caja negra.
            </p>
          </li>
        </ul>
      </Panel>
    </>
  )
}
