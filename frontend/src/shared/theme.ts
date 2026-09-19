export type Theme = 'light' | 'dark'

const KEY = 'embat-theme'

/** Tema guardado o, si no hay, claro (el de la marca). */
export function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* almacenamiento bloqueado: claro */ }
  return 'light'
}

/** Aplica el tema con un fundido (View Transitions) donde el navegador lo soporte. */
export function applyTheme(t: Theme, animate = true) {
  const set = () => { document.documentElement.dataset.theme = t }
  if (animate && document.startViewTransition) {
    const vt = document.startViewTransition(set)
    // Pulsar dos veces seguidas aborta la transición anterior: rechaza, pero no es un error.
    vt.ready.catch(() => {})
    vt.finished.catch(() => {})
  } else set()
  try { localStorage.setItem(KEY, t) } catch { /* sin persistencia */ }
}
