import { ApiError } from '../api'
import './shared.css'

interface ErrorNoticeProps {
  title: string
  error: Error
  onRetry?: () => void
}

/** Explica qué pasó y cómo seguir, sin disculpas. */
export function ErrorNotice({ title, error, onRetry }: ErrorNoticeProps) {
  const detail =
    error instanceof ApiError && error.status === 404
      ? error.message
      : 'Comprueba la conexión y vuelve a intentarlo. Si el problema sigue, avisa al equipo de datos.'
  return (
    <div className="notice notice--error" role="alert">
      <p className="notice__title">{title}</p>
      <p className="muted">{detail}</p>
      {onRetry ? (
        <button type="button" className="btn" onClick={onRetry}>
          Reintentar la carga
        </button>
      ) : null}
    </div>
  )
}
