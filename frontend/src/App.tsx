import { useState } from 'react'
import './App.css'
import { CompanyView } from './company/CompanyView'
import { EvidenceView } from './portfolio/EvidenceView'
import { PortfolioView } from './portfolio/PortfolioView'

type Vista = 'cartera' | 'empresa' | 'evidencia'

const TABS: { id: Vista; label: string }[] = [
  { id: 'cartera', label: 'Cartera' },
  { id: 'empresa', label: 'Empresa' },
  { id: 'evidencia', label: 'Evidencia' },
]

export default function App() {
  const [vista, setVista] = useState<Vista>('cartera')
  const [companyId, setCompanyId] = useState('c-0001')

  const abrirEmpresa = (id: string) => {
    setCompanyId(id)
    setVista('empresa')
  }

  return (
    <div className="shell">
      <header className="topbar">
        <span className="mark" aria-hidden="true" />
        <strong>Pulso</strong>
        <nav>
          {TABS.map((t) => (
            <button
              key={t.id} type="button"
              className={vista === t.id ? 'on' : ''}
              onClick={() => setVista(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="page">
        {vista === 'cartera' && <PortfolioView onSelect={abrirEmpresa} />}
        {vista === 'empresa' && <CompanyView companyId={companyId} />}
        {vista === 'evidencia' && <EvidenceView />}
      </main>
    </div>
  )
}
