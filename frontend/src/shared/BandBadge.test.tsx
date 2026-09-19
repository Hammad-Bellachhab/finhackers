import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BandBadge } from './BandBadge'
import { Delta } from './Delta'

describe('BandBadge', () => {
  it('muestra nivel y trayectoria por separado', () => {
    render(<BandBadge band="healthy" trend="down" />)
    // El caso Velasco: sana de nivel, pero torciendose
    expect(screen.getByText('Sana')).toBeInTheDocument()
    expect(screen.getByLabelText('tendencia a la baja')).toBeInTheDocument()
  })

  it('etiqueta las tres bandas en español', () => {
    const { rerender } = render(<BandBadge band="stable" trend="flat" />)
    expect(screen.getByText('Estable')).toBeInTheDocument()
    rerender(<BandBadge band="risk" trend="flat" />)
    expect(screen.getByText('En riesgo')).toBeInTheDocument()
  })
})

describe('Delta', () => {
  it('antepone el signo y marca la direccion', () => {
    render(<Delta value={7} />)
    expect(screen.getByText('+7')).toBeInTheDocument()
  })
  it('muestra los negativos con su signo', () => {
    render(<Delta value={-9} />)
    expect(screen.getByText('-9')).toBeInTheDocument()
  })
})
