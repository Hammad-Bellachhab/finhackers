import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CompanyScore } from '../api/types'
import { PulseSection } from './PulseSection'

const velasco: CompanyScore = {
  companyId: 'c-1', name: 'Velasco Industrial',
  score: 68, band: 'healthy', trend: 'down', delta1m: -3, delta3m: -9,
  series: Array.from({ length: 24 }, (_, i) => ({
    month: `2025-${String((i % 12) + 1).padStart(2, '0')}`, score: Math.round(82 - i * 0.6),
  })),
  drivers: [{
    id: 'dso', label: 'El cobro se alarga', direction: 'down', impact: -4.2,
    since: '2026-04', detail: 'Tus clientes tardan más en pagarte que hace un año.',
  }],
  metrics: [{
    id: 'dso', label: 'Días en cobrar', value: 62, unit: 'days', reference: 45, status: 'breach',
  }],
  heldOut: true,
}

describe('PulseSection', () => {
  it('muestra el nombre, el score y la banda', () => {
    render(<PulseSection score={velasco} />)
    expect(screen.getByText('Velasco Industrial')).toBeInTheDocument()
    expect(screen.getByText('68')).toBeInTheDocument()
    expect(screen.getByText('Sana')).toBeInTheDocument()
  })

  it('avisa de que el modelo no vio nunca esta empresa', () => {
    render(<PulseSection score={velasco} />)
    expect(screen.getByText(/no vista en entrenamiento/i)).toBeInTheDocument()
  })

  it('explica que señal se movio y desde cuando', () => {
    render(<PulseSection score={velasco} />)
    expect(screen.getByText('El cobro se alarga')).toBeInTheDocument()
    expect(screen.getByText(/abr 2026/)).toBeInTheDocument()
  })

  it('muestra las metricas con su valor formateado', () => {
    render(<PulseSection score={velasco} />)
    expect(screen.getByText('Días en cobrar')).toBeInTheDocument()
    expect(screen.getByText('62 d')).toBeInTheDocument()
  })

  it('mantiene nivel y trayectoria separados: sana pero cayendo', () => {
    render(<PulseSection score={velasco} />)
    expect(screen.getByText('Sana')).toBeInTheDocument()
    expect(screen.getByLabelText('tendencia a la baja')).toBeInTheDocument()
  })
})
