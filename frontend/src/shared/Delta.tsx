import './shared.css'

export function Delta({ value, suffix = '' }: { value: number; suffix?: string }) {
  const dir = value > 0 ? 'up' : value < 0 ? 'down' : 'flat'
  const shown = `${value > 0 ? '+' : ''}${Math.round(value)}`
  return <span className={`delta delta-${dir}`}>{shown}{suffix}</span>
}
