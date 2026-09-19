import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EvidenceView } from './EvidenceView'

describe('EvidenceView', () => {
  it('demuestra la generalizacion sobre el test oculto', async () => {
    render(<EvidenceView />)
    await waitFor(() => expect(screen.getByText(/empresas no vistas/i)).toBeInTheDocument())
  })

  it('mide la anticipacion en meses, no la afirma', async () => {
    render(<EvidenceView />)
    await waitFor(() => expect(screen.getByText(/meses de antelación/i)).toBeInTheDocument())
  })

  it('mide las dos caras por separado', async () => {
    render(<EvidenceView />)
    await waitFor(() => {
      expect(screen.getByText(/detecta la mejora/i)).toBeInTheDocument()
      expect(screen.getByText(/detecta el deterioro/i)).toBeInTheDocument()
    })
  })

  it('separa baches de deterioros reales', async () => {
    render(<EvidenceView />)
    await waitFor(() => expect(screen.getByText(/baches no confundidos/i)).toBeInTheDocument())
  })
})
