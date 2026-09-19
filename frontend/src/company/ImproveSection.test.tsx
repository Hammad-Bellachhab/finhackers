import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getPlan } from '../api'
import type { Decision, Metric } from '../api/types'
import { ImproveSection } from './ImproveSection'

vi.mock('../api', { spy: true })

const metrics: Metric[] = [
  { id: 'dso', label: 'Días en cobrar', value: 62, unit: 'days', reference: 45, status: 'breach' },
  { id: 'dpo', label: 'Días en pagar', value: 30, unit: 'days', reference: 45, status: 'watch' },
  { id: 'cash_days', label: 'Días de caja', value: 70, unit: 'days', reference: 60, status: 'ok' },
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

const render1 = () =>
  render(<ImproveSection companyId="c-0001" decisions={decisions} metrics={metrics} />)

describe('ImproveSection', () => {
  it('ofrece una palanca por cada cosa que se puede mover, con su aviso', async () => {
    render1()
    expect(screen.getByText('Acelera el cobro')).toBeInTheDocument()
    expect(screen.getByText('Negocia más plazo con proveedores')).toBeInTheDocument()
    expect(screen.getByText(/daña la relación/i)).toBeInTheDocument()
    expect(screen.getByText('184.000 €', { exact: false })).toBeInTheDocument()
  })

  it('no ofrece palanca para una metrica que ya esta en su sitio', () => {
    render1()
    // cash_days esta en 'ok' y no tiene decision: no hay nada que corregir ahi.
    expect(screen.queryByLabelText(/mover días de caja/i)).toBeNull()
  })

  it('calcula el plan con todas las palancas activas', async () => {
    render1()
    await waitFor(() => expect(screen.getByTestId('plan-score')).toBeInTheDocument())
    expect(Number(screen.getByTestId('plan-score').textContent)).toBeGreaterThan(0)
  })

  it('descartar una palanca recalcula el plan con las que quedan', async () => {
    render1()
    await waitFor(() => expect(screen.getByTestId('plan-score')).toBeInTheDocument())
    const antes = screen.getByTestId('plan-score').textContent

    // La primera palanca es la de mayor efecto: al quitarla el plan tiene que dar menos.
    fireEvent.click(screen.getAllByRole('button', { name: 'Descartar' })[0])

    await waitFor(() => expect(screen.getByTestId('plan-score').textContent).not.toBe(antes))
    expect(Number(screen.getByTestId('plan-score').textContent)).toBeLessThan(Number(antes))
  })

  it('una palanca descartada queda marcada y su slider bloqueado', async () => {
    render1()
    const boton = screen.getAllByRole('button', { name: 'Descartar' })[0]
    fireEvent.click(boton)

    const recuperar = screen.getByRole('button', { name: 'Recuperar' })
    expect(recuperar).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText(/mover días en cobrar/i)).toBeDisabled()
    // El estado no va solo en el color: tambien en el texto.
    expect(screen.getByText(/— descartada/)).toBeInTheDocument()
  })

  it('se puede recuperar una palanca descartada', async () => {
    render1()
    await waitFor(() => expect(screen.getByTestId('plan-score')).toBeInTheDocument())
    const inicial = screen.getByTestId('plan-score').textContent

    fireEvent.click(screen.getAllByRole('button', { name: 'Descartar' })[0])
    await waitFor(() => expect(screen.getByTestId('plan-score').textContent).not.toBe(inicial))

    fireEvent.click(screen.getByRole('button', { name: 'Recuperar' }))
    await waitFor(() => expect(screen.getByTestId('plan-score').textContent).toBe(inicial))
  })

  it('mover una palanca cambia el plan', async () => {
    render1()
    await waitFor(() => expect(screen.getByTestId('plan-score')).toBeInTheDocument())
    const antes = screen.getByTestId('plan-score').textContent

    fireEvent.change(screen.getByLabelText(/mover días en cobrar/i), { target: { value: '30' } })
    await waitFor(() => expect(screen.getByTestId('plan-score').textContent).not.toBe(antes))
  })

  it('dice cuando el numero es una estimacion y no viene del modelo', async () => {
    render1()
    await waitFor(() => expect(screen.getByTestId('plan-score')).toBeInTheDocument())
    // Sin motor levantado (en tests no lo hay) el plan se aproxima, y eso se avisa.
    expect(screen.getByText(/Estimación/)).toBeInTheDocument()
  })

  it('no desmonta el diagnostico mientras recalcula: la pagina no puede dar saltos', async () => {
    render1()
    await waitFor(() => expect(screen.getByTestId('plan-score')).toBeInTheDocument())
    const llamadasIniciales = vi.mocked(getPlan).mock.calls.length

    // La siguiente peticion se deja colgada a proposito: ese es justo el instante en el que el
    // bloque desaparecia, el documento encogia ~340 px y la pagina saltaba bajo el cursor.
    vi.mocked(getPlan).mockReturnValueOnce(new Promise(() => {}))
    fireEvent.change(screen.getByLabelText(/mover días en cobrar/i), { target: { value: '30' } })
    await waitFor(() =>
      expect(vi.mocked(getPlan).mock.calls.length).toBeGreaterThan(llamadasIniciales),
    )

    expect(screen.getByText('Qué se lo está bajando')).toBeInTheDocument()
    expect(screen.getByTestId('plan-score')).toBeInTheDocument()
    expect(screen.queryByText('Calculando el plan…')).toBeNull()
  })

  it('avisa cuando no hay nada que corregir', () => {
    render(<ImproveSection companyId="c-0001" decisions={[]} metrics={[metrics[2]]} />)
    expect(screen.getByText(/no hay nada que corregir/i)).toBeInTheDocument()
  })
})
