import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getTellMe } from '../api'
import { TellMeCard } from './TellMeCard'

vi.mock('../api', { spy: true })

describe('TellMeCard', () => {
  it('pinta titular, severidad en texto, evidencia y acción', async () => {
    render(<TellMeCard />)
    expect(await screen.findByRole('heading', { name: '885 empresas sanas; 169 empiezan a torcerse' })).toBeInTheDocument()
    expect(screen.getByText('Vigilar')).toBeInTheDocument()
    expect(screen.getByText('72 d')).toBeInTheDocument()
    expect(screen.getByText('Qué hacer:')).toBeInTheDocument()
    expect(screen.getByText(/Generado por TellMe · mock/)).toBeInTheDocument()
  })

  it('sin análisis (404 → null) no es un error', async () => {
    vi.mocked(getTellMe).mockResolvedValueOnce(null)
    render(<TellMeCard companyId="c-0001" />)
    expect(await screen.findByText('TellMe aún no ha analizado esta empresa.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
