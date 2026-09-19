import './shared.css'

export function Skeleton({ height = '12rem' }: { height?: string }) {
  return <div className="skeleton" style={{ height }} aria-busy="true" aria-label="Cargando" />
}

export function Empty({ message }: { message: string }) {
  return <p className="empty">{message}</p>
}

/** El front tiene que pintar algo aunque el motor este apagado: en una demo,
 *  una pantalla en blanco cuesta mas que cualquier error del modelo. */
export function ErrorNotice({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="error-notice" role="alert">
      <strong>No se han podido cargar los datos.</strong>
      <span>{error.message}</span>
      {onRetry && <button type="button" onClick={onRetry}>Reintentar</button>}
    </div>
  )
}
