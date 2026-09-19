import './shared.css'

/** Etiqueta de texto del motor (banda, trayectoria o señal) con su color. */
export function Pill({ text }: { text: string }) {
  if (!text) return <span className="muted">—</span>
  return <span className={`pill pill-${text.replace(/ /g, '-').replace(/,.*/, '')}`}>{text}</span>
}
