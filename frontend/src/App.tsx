import { useState } from 'react'
import './App.css'
import { DEFAULT_COMPANY } from './api'
import { CompanyView } from './company/CompanyView'
import { AlertsView } from './portfolio/AlertsView'
import { EvidenceView } from './portfolio/EvidenceView'
import { ModelView } from './portfolio/ModelView'
import { PortfolioView } from './portfolio/PortfolioView'
import { CompanyProvidersView } from './providers/CompanyProvidersView'
import { ProvidersView } from './providers/ProvidersView'

type Vista =
  | 'cartera' | 'alertas' | 'proveedores' | 'evidencia' | 'modelo'
  | 'empresa' | 'empresa-proveedores'

/** Dos planos distintos: lo que se ve de toda la cartera y lo que se ve de una empresa.
 *  Separarlos en la barra evita la pregunta "¿esto de quién es?" en mitad de la demo. */
const GRUPOS: { id: string; label: string; tabs: { id: Vista; label: string }[] }[] = [
  {
    id: 'global', label: 'Global',
    tabs: [
      { id: 'cartera', label: 'Cartera' },
      { id: 'alertas', label: 'Alertas' },
      { id: 'proveedores', label: 'Proveedores' },
      { id: 'evidencia', label: 'Evidencia' },
      { id: 'modelo', label: 'Modelo' },
    ],
  },
  {
    id: 'cliente', label: 'Cliente',
    tabs: [
      { id: 'empresa', label: 'Empresa' },
      { id: 'empresa-proveedores', label: 'Proveedores' },
    ],
  },
]

export default function App() {
  const [vista, setVista] = useState<Vista>('cartera')
  const [companyId, setCompanyId] = useState(DEFAULT_COMPANY)

  const abrirEmpresa = (id: string) => {
    setCompanyId(id)
    setVista('empresa')
  }

  return (
    <div className="shell">
      <header className="topbar">
        <span className="logo" role="img" aria-label="Embat" />
        <span className="topbar-sep" aria-hidden="true" />
        <span className="product">X-Ray</span>
        <nav>
          {GRUPOS.map((g) => (
            <div className="navgroup" key={g.id} role="group" aria-label={g.label}>
              <span className="navgroup-label" aria-hidden="true">{g.label}</span>
              <div className="navgroup-tabs">
                {g.tabs.map((t) => (
                  <button
                    key={t.id} type="button"
                    className={vista === t.id ? 'on' : ''}
                    aria-current={vista === t.id ? 'page' : undefined}
                    onClick={() => setVista(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </header>

      <main className="page">
        {vista === 'cartera' && <PortfolioView onSelect={abrirEmpresa} />}
        {vista === 'alertas' && <AlertsView onSelect={abrirEmpresa} />}
        {vista === 'proveedores' && <ProvidersView onSelect={abrirEmpresa} />}
        {vista === 'evidencia' && <EvidenceView />}
        {vista === 'modelo' && <ModelView />}
        {vista === 'empresa' && <CompanyView companyId={companyId} onSelect={setCompanyId} />}
        {vista === 'empresa-proveedores' && (
          <CompanyProvidersView companyId={companyId} onSelect={setCompanyId} />
        )}
      </main>
    </div>
  )
}
