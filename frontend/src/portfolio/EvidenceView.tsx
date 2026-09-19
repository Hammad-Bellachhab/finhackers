import { getEvidence } from '../api'
import { useAsync } from '../shared/useAsync'
import { ErrorNotice, Skeleton } from '../shared/States'
import { formatPct } from '../shared/format'
import './portfolio.css'

/** La rubrica, medida y en pantalla. Casi todos los equipos dejan esto en un
 *  slide; enseñarlo en vivo es barato y pesa un tercio de la nota. */
export function EvidenceView() {
  const { data, error, loading } = useAsync(() => getEvidence(), [])

  if (loading) return <Skeleton height="18rem" />
  if (error) return <ErrorNotice error={error} />
  if (!data) return null

  return (
    <>
      <h2>Si acierta</h2>
      <div className="counts">
        <div className="count">
          <strong>{data.holdout.companies}</strong><span>Empresas no vistas nunca</span>
        </div>
        <div className="count">
          <strong>{data.holdout.auc.toFixed(2)}</strong><span>AUC en holdout</span>
        </div>
        <div className="count">
          <strong>{data.holdout.spearman.toFixed(2)}</strong><span>Correlación de orden</span>
        </div>
      </div>

      <h2>Las dos caras</h2>
      <div className="counts">
        <div className="count">
          <strong>{formatPct(data.bothDirections.improvingRecall)}</strong>
          <span>Detecta la mejora</span>
        </div>
        <div className="count">
          <strong>{formatPct(data.bothDirections.slippingRecall)}</strong>
          <span>Detecta el deterioro</span>
        </div>
      </div>

      <h2>Si llega a tiempo</h2>
      <div className="counts">
        <div className="count">
          <strong>{data.anticipation.medianMonths}</strong>
          <span>Meses de antelación (mediana)</span>
        </div>
        <div className="count">
          <strong>{data.anticipation.p25}–{data.anticipation.p75}</strong>
          <span>Rango intercuartílico</span>
        </div>
        <div className="count">
          <strong>{data.anticipation.detected}</strong><span>Casos con detección previa</span>
        </div>
      </div>

      <h2>Estabilidad</h2>
      <div className="counts">
        <div className="count">
          <strong>{data.stability.dipsCorrectlyIgnored}</strong><span>Baches no confundidos</span>
        </div>
        <div className="count">
          <strong>{data.stability.structuralCaught}</strong><span>Deterioros reales detectados</span>
        </div>
      </div>
    </>
  )
}
