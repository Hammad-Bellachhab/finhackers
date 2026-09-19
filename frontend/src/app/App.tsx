import { CompanyProfileView } from '../company-profile/CompanyProfileView'
import { PortfolioView } from '../portfolio/PortfolioView'
import { ThemeToggle } from '../theme/ThemeToggle'
import { useTheme } from '../theme/useTheme'
import { paths, useRoute, type Route } from './route'
import './app.css'

interface NavItem {
  label: string
  href: string
  current: (route: Route) => boolean
}

const NAV: readonly NavItem[] = [
  { label: 'Cartera', href: paths.cartera, current: (r) => r.name === 'cartera' || r.name === 'empresa' },
]

function RouteView({ route }: { route: Route }) {
  switch (route.name) {
    case 'cartera':
      return <PortfolioView />
    case 'empresa':
      return <CompanyProfileView key={route.id} companyId={route.id} />
    default:
      return (
        <div className="stack">
          <h1 className="t-h1">No encontramos esta página</h1>
          <p className="muted">La dirección no corresponde a ninguna vista. Vuelve a la cartera para seguir.</p>
          <a className="btn" href={paths.cartera}>
            Ir a la cartera
          </a>
        </div>
      )
  }
}

export function App() {
  const [theme, setTheme] = useTheme()
  const route = useRoute()

  return (
    <div className="shell">
      <header className="shell__bar">
        <div className="shell__brand">
          <span className="shell__mark" aria-hidden="true" />
          <span className="t-h2">Salud financiera de la cartera</span>
        </div>
        <nav className="shell__nav" aria-label="Vistas">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="shell__link" aria-current={item.current(route) ? 'page' : undefined}>
              {item.label}
            </a>
          ))}
        </nav>
        <ThemeToggle theme={theme} onChange={setTheme} />
      </header>
      <main className="shell__main">
        <RouteView route={route} />
      </main>
    </div>
  )
}
