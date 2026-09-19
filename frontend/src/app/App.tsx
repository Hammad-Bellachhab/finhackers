import { ThemeToggle } from '../theme/ThemeToggle'
import { useTheme } from '../theme/useTheme'
import './app.css'

export function App() {
  const [theme, setTheme] = useTheme()

  return (
    <div className="shell">
      <header className="shell__bar">
        <div className="shell__brand">
          <span className="shell__mark" aria-hidden="true" />
          <span className="t-h2">Salud financiera de la cartera</span>
        </div>
        <ThemeToggle theme={theme} onChange={setTheme} />
      </header>
      <main className="shell__main">
        <h1 className="t-h1">Cartera</h1>
        <p className="muted">La cartera se está preparando.</p>
      </main>
    </div>
  )
}
