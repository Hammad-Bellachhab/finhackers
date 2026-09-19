import { getAlerts, getEvidence } from '../api'
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

/** La rúbrica del brief (docs/reto-embat.md · "Cómo se evalúa"), medida y en pantalla: tres
 *  bloques con el mismo peso. Casi todos los equipos dejan esto en un slide; enseñarlo en
 *  vivo es barato y vale un tercio de la nota. */
export function EvidenceView() {
  const evidence = useAsync(() => getEvidence(), [])
  const alerts = useAsync(() => getAlerts(), [])

  if (evidence.loading) return <Skeleton height="30rem" />
  if (evidence.error) return <ErrorNotice error={evidence.error} />
  const data = evidence.data
  if (!data) return null

  return (
    <>
      <h2>Cómo se evalúa esto</h2>
      <p className="muted legend-line">
        Tres bloques, el mismo peso: si acierta, si llega a tiempo, si vale algo. Cada número de aquí sale
        del motor real, sobre empresas que nunca vio en entrenamiento.
      </p>

      <Panel
        title="Si acierta"
        note="Generalización a empresas no vistas, trayectoria (no solo nivel) y las dos caras: la mejora igual que el deterioro."
      >
        <div className="counts">
          <Stat value={String(data.holdout.companies)} label="Empresas no vistas nunca" />
          <Stat value={data.holdout.auc.toFixed(2)} label="AUC en holdout" />
          <Stat value={data.holdout.spearman.toFixed(2)} label="Correlación de orden" />
          <Stat value={formatPct(data.bothDirections.improvingRecall)} label="Detecta la mejora" />
          <Stat value={formatPct(data.bothDirections.slippingRecall)} label="Detecta el deterioro" />
        </div>
        <p className="legend-line muted panel-footnote">
          Nivel y trayectoria son ejes independientes: una empresa puede salir "sana" y aun así ir cayendo
          (el caso Velasco del brief) — el score no lo confunde con una que sube desde abajo.
        </p>
      </Panel>

      <Panel
        title="Si llega a tiempo"
        note="Anticipación medida, no afirmada. Bache puntual distinguido de deterioro real. Monitor que avisa solo."
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
      </Panel>

      <Panel
        title="Si vale algo"
        note="Producto, comprador y explicación — lo que hace que alguien firme, no solo que el número sea bueno."
      >
        <ul className="value-cards">
          <li>
            <h4>Producto — Pulso Crédito, la línea que respira</h4>
            <p>
              Límite y precio de la línea de circulante recalculados cada mes con salud y trayectoria, no
              revisados una vez al año.
            </p>
          </li>
          <li>
            <h4>Comprador — el prestamista</h4>
            <p>
              Paga el motor porque ve riesgo real y actualizado. La pyme comparte su score —nunca sus
              movimientos— con consentimiento explícito, mínimo y revocable, a cambio de crédito más barato,
              más rápido y con aviso previo al recorte. Embat es el canal, a coste marginal cero.
            </p>
          </li>
          <li>
            <h4>Explicación</h4>
            <p>
              Cada score trae sus señales dominantes y desde cuándo se mueven (pestaña Empresa, "Qué lo ha
              movido") — nunca es una caja negra.
            </p>
          </li>
        </ul>
      </Panel>
    </>
  )
}
