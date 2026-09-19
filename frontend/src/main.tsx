import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/global.css'
import { App } from './app/App'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('No se encuentra el elemento #root en index.html')

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
