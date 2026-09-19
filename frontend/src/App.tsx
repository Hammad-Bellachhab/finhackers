import { useState } from 'react'
import './App.css'
import { DEFAULT_COMPANY } from './api'
import { CompanyView } from './company/CompanyView'
import { AskTellMe } from './shared/AskTellMe'
import { AlertsView } from './portfolio/AlertsView'
import { EvidenceView } from './portfolio/EvidenceView'
import { ModelView } from './portfolio/ModelView'
import { PortfolioView } from './portfolio/PortfolioView'

type Vista = 'cartera' | 'alertas' | 'empresa' | 'evidencia' | 'modelo'

const TABS: { id: Vista; label: string }[] = [
  { id: 'cartera', label: 'Cartera' },
  { id: 'alertas', label: 'Alertas' },
  { id: 'empresa', label: 'Empresa' },
  { id: 'evidencia', label: 'Evidencia' },
  { id: 'modelo', label: 'Modelo' },
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
          {TABS.map((t) => (
            <button
              key={t.id} type="button"
              className={vista === t.id ? 'on' : ''}
              aria-current={vista === t.id ? 'page' : undefined}
              onClick={() => setVista(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="page">
        {vista === 'cartera' && <PortfolioView onSelect={abrirEmpresa} />}
        {vista === 'alertas' && <AlertsView onSelect={abrirEmpresa} />}
        {vista === 'empresa' && <CompanyView companyId={companyId} onSelect={setCompanyId} />}
        {vista === 'evidencia' && <EvidenceView />}
        {vista === 'modelo' && <ModelView />}
      </main>

      {/* key: cambiar de empresa (o volver a la cartera) empieza otra conversación */}
      <AskTellMe key={vista === 'empresa' ? companyId : 'cartera'} companyId={vista === 'empresa' ? companyId : undefined} />
    </div>
  )
}
