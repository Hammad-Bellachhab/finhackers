import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { EmbatHome, XRayLanding } from './landing/Landing'
import { useEffect, useState } from 'react'
import { applyTheme, initialTheme } from './shared/theme'

applyTheme(initialTheme(), false)

/** Rutas por hash (sirven igual en Vite y en Cloudflare sin configurar nada):
 *  #/ Embat  ·  #/xray presentación de X-Ray  ·  #/app la demo. */
function Root() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const on = () => { setHash(location.hash); window.scrollTo(0, 0) }
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  const page = hash.startsWith('#/app') ? <App /> : hash.startsWith('#/xray') ? <XRayLanding /> : <EmbatHome />
  return <div key={hash.split('?')[0]} className="route-enter">{page}</div>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
