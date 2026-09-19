import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PortfolioRow } from '../api/types'
import { PortfolioTable } from './PortfolioTable'

const rows: PortfolioRow[] = [
  { companyId: 'c-1', name: 'Velasco Industrial', score: 68, band: 'healthy', trend: 'down',
    delta3m: -9, heldOut: true, topDriver: 'El cobro se alarga' },
  { companyId: 'c-2', name: 'Northbrook Foods', score: 65, band: 'stable', trend: 'up',
    delta3m: 12, heldOut: false, topDriver: 'Colchón de caja' },
  { companyId: 'c-3', name: 'Almenar Logística', score: 31, band: 'risk', trend: 'flat',
    delta3m: 0, heldOut: false, topDriver: 'Uso de líneas' },
]

describe('PortfolioTable', () => {
  it('lista las empresas con su nivel y su trayectoria', () => {
    render(<PortfolioTable rows={rows} onSelect={() => {}} />)
    expect(screen.getByText('Velasco Industrial')).toBeInTheDocument()
    expect(screen.getByText('Sana')).toBeInTheDocument()
    expect(screen.getByText('En riesgo')).toBeInTheDocument()
  })

  it('marca las empresas del test oculto', () => {
    render(<PortfolioTable rows={rows} onSelect={() => {}} />)
    expect(screen.getAllByTitle(/no vista en entrenamiento/i)).toHaveLength(1)
  })

  it('filtra por direccion del movimiento, mostrando las dos caras', async () => {
    render(<PortfolioTable rows={rows} onSelect={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /mejorando/i }))
    expect(screen.getByText('Northbrook Foods')).toBeInTheDocument()
    expect(screen.queryByText('Velasco Industrial')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /torciéndose/i }))
    expect(screen.getByText('Velasco Industrial')).toBeInTheDocument()
    expect(screen.queryByText('Northbrook Foods')).not.toBeInTheDocument()
  })

  it('destaca a los sanos que estan cayendo', () => {
    render(<PortfolioTable rows={rows} onSelect={() => {}} />)
    // Velasco: nivel sano, tendencia a la baja. Ese es el caso interesante.
    const fila = screen.getByText('Velasco Industrial').closest('tr')!
    expect(fila.className).toContain('row-watch')
  })

  it('abre la ficha al pulsar una fila', async () => {
    const onSelect = vi.fn()
    render(<PortfolioTable rows={rows} onSelect={onSelect} />)
    await userEvent.click(screen.getByText('Northbrook Foods'))
    expect(onSelect).toHaveBeenCalledWith('c-2')
  })

  it('avisa cuando ningun filtro devuelve empresas', async () => {
    render(<PortfolioTable rows={[rows[2]]} onSelect={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /mejorando/i }))
    expect(screen.getByText(/ninguna empresa cumple/i)).toBeInTheDocument()
  })
})
