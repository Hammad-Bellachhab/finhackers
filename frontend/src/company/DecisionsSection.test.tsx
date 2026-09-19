import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Decision, Metric } from '../api/types'
import { DecisionsSection } from './DecisionsSection'

const metrics: Metric[] = [
  { id: 'dso', label: 'Días en cobrar', value: 62, unit: 'days', reference: 45, status: 'breach' },
]

const decisions: Decision[] = [
  {
    id: 'd1', lever: 'collect_faster', title: 'Acelera el cobro',
    rationale: 'Tu DSO supera en más de 10 días tu mediana de los últimos 12 meses.',
    metricId: 'dso', currentValue: 62, targetValue: 45,
    cashImpact: 184000, scoreImpact: 7, caution: null,
  },
  {
    id: 'd2', lever: 'pay_slower', title: 'Negocia más plazo con proveedores',
    rationale: 'Pagas antes que tu histórico mientras la caja está tensa.',
    metricId: 'dpo', currentValue: 30, targetValue: 45,
    cashImpact: 60000, scoreImpact: 2,
    caution: 'Forzar el plazo daña la relación y acaba en peores precios.',
  },
]

describe('DecisionsSection', () => {
  it('muestra las palancas con su impacto en euros y puntos', () => {
    render(<DecisionsSection companyId="c-0001" decisions={decisions} metrics={metrics} />)
    expect(screen.getByText('Acelera el cobro')).toBeInTheDocument()
    expect(screen.getByText('184.000 €')).toBeInTheDocument()
    expect(screen.getByText('+7')).toBeInTheDocument()
  })

  it('muestra el aviso cuando la palanca tiene contraindicacion', () => {
    render(<DecisionsSection companyId="c-0001" decisions={decisions} metrics={metrics} />)
    expect(screen.getByText(/daña la relación/i)).toBeInTheDocument()
  })

  it('explica la regla que disparo cada palanca', () => {
    render(<DecisionsSection companyId="c-0001" decisions={decisions} metrics={metrics} />)
    expect(screen.getByText(/supera en más de 10 días/i)).toBeInTheDocument()
  })

  it('el simulador recalcula el score al mover la metrica', async () => {
    render(<DecisionsSection companyId="c-0001" decisions={decisions} metrics={metrics} />)
    // Un input[type=range] no se escribe: se dispara su change con el valor nuevo.
    const slider = screen.getByLabelText(/simular/i) as HTMLInputElement
    await waitFor(() => expect(screen.getByTestId('sim-score')).toBeInTheDocument())
    const antes = screen.getByTestId('sim-score').textContent
    fireEvent.change(slider, { target: { value: '45' } })
    await waitFor(() => expect(screen.getByTestId('sim-score').textContent).not.toBe(antes))
  })

  it('avisa cuando no hay ninguna palanca que recomendar', () => {
    render(<DecisionsSection companyId="c-0001" decisions={[]} metrics={metrics} />)
    expect(screen.getByText(/no hay nada urgente/i)).toBeInTheDocument()
  })
})
