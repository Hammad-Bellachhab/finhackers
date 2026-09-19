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

  it('si la peticion falla despues de un exito, lo dice en vez de dar por bueno el plan viejo', async () => {
    render1()
    await waitFor(() => expect(screen.getByTestId('plan-score')).toBeInTheDocument())
    const llamadas = vi.mocked(getPlan).mock.calls.length

    vi.mocked(getPlan).mockRejectedValueOnce(new Error('el motor no responde'))
    fireEvent.change(screen.getByLabelText(/mover días en cobrar/i), { target: { value: '20' } })
    await waitFor(() =>
      expect(vi.mocked(getPlan).mock.calls.length).toBeGreaterThan(llamadas),
    )

    // Se sigue viendo el ultimo plan bueno (no se vacia, no hay salto), pero se avisa de que no
    // corresponde a donde estan los sliders.
    await waitFor(() => expect(screen.getByText(/no se ha podido actualizar/i)).toBeInTheDocument())
    expect(screen.getByTestId('plan-score')).toBeInTheDocument()
  })

  it('mientras el resumen no corresponde a los sliders, se marca como desfasado', async () => {
    render1()
    await waitFor(() => expect(screen.getByTestId('plan-score')).toBeInTheDocument())
    await waitFor(() =>
      expect(document.querySelector('.plan-total')?.className).not.toContain('plan-total-stale'),
    )

    // Nada mas mover, y aun dentro del debounce (sin peticion en vuelo todavia), los numeros que
    // se ven son los de la posicion anterior: hay que decirlo.
    fireEvent.change(screen.getByLabelText(/mover días en cobrar/i), { target: { value: '20' } })
    expect(document.querySelector('.plan-total')?.className).toContain('plan-total-stale')
  })

  it('el diagnostico no cambia de tamaño aunque cambie el plan', async () => {
    render1()
    await waitFor(() => expect(screen.getByTestId('plan-score')).toBeInTheDocument())
    const antes = document.querySelectorAll('.drags li').length
    const scoreAntes = screen.getByTestId('plan-score').textContent

    // El motor devuelve 6 drags y la rejilla precalculada entre 0 y 5: si el bloque siguiera al
    // plan, alternar de camino repintaria otra lista y la pagina daria un salto de 200-300 px.
    vi.mocked(getPlan).mockResolvedValueOnce({
      companyId: 'c-0001', baseHealth: 60, planHealth: 70, scoreDelta: 10,
      levers: [], drags: [], exact: true,
    })
    fireEvent.change(screen.getByLabelText(/mover días en cobrar/i), { target: { value: '20' } })
    // No se fija la cifra: al total se le suman los drags sin palanca del primer diagnostico, que
    // salen de la rejilla precalculada. Basta con esperar a que el plan nuevo haya entrado.
    await waitFor(() => expect(screen.getByTestId('plan-score').textContent).not.toBe(scoreAntes))

    expect(document.querySelectorAll('.drags li').length).toBe(antes)
  })

  it('suma en el techo lo que le hunde y ningun slider toca', async () => {
    // El diagnostico se fija con la primera respuesta, asi que el mock va antes del render.
    vi.mocked(getPlan).mockResolvedValueOnce({
      companyId: 'c-0001', baseHealth: 60, planHealth: 70, scoreDelta: 10, levers: [], exact: true,
      drags: [
        // Este si tiene palanca (dso): ya esta dentro de planHealth, no puede contar dos veces.
        { id: 'g1', label: 'Cobra tarde', impact: -3, block: 'C', metricId: 'dso' },
        { id: 'g2', label: 'Ingresos a la baja', impact: -2.5, block: 'B', metricId: null },
        // ccc queda fuera de las palancas a proposito (pisaria a dso), asi que cuenta aqui.
        { id: 'g3', label: 'Ciclo de caja largo', impact: -1.5, block: 'C', metricId: 'ccc' },
      ],
    })
    render1()

    // 70 + 2,5 + 1,5 = 74, y el delta va desde la salud de hoy: 74 - 60 = +14.
    // El drag de dso no entra: su palanca ya esta dentro de planHealth.
    await waitFor(() => expect(screen.getByTestId('plan-score').textContent).toBe('74'))
    expect(screen.getByText(/\(\+14 puntos\)/)).toBeInTheDocument()
    // El pie desglosa que parte del total no esta repuntuada.
    expect(screen.getByText(/Incluye 4 puntos de 2 señales sin palanca directa/)).toBeInTheDocument()
  })

  it('el techo no pasa de 100 y el delta se recorta con el', async () => {
    vi.mocked(getPlan).mockResolvedValueOnce({
      companyId: 'c-0001', baseHealth: 90, planHealth: 95, scoreDelta: 5, levers: [], exact: true,
      drags: [{ id: 'g1', label: 'Ingresos a la baja', impact: -30, block: 'B', metricId: null }],
    })
    render1()

    // 95 + 30 = 125, pero la salud es 0-100: se queda en 100 y el delta en +10, no en +35.
    await waitFor(() => expect(screen.getByTestId('plan-score').textContent).toBe('100'))
    expect(screen.getByText(/\(\+10 puntos\)/)).toBeInTheDocument()
  })

  it('sin drags huerfanos el total es el del modelo, sin tocar', async () => {
    vi.mocked(getPlan).mockResolvedValueOnce({
      companyId: 'c-0001', baseHealth: 60, planHealth: 70, scoreDelta: 10, levers: [], exact: true,
      drags: [{ id: 'g1', label: 'Cobra tarde', impact: -3, block: 'C', metricId: 'dso' }],
    })
    render1()

    await waitFor(() => expect(screen.getByTestId('plan-score').textContent).toBe('70'))
    expect(screen.queryByText(/sin palanca directa/)).toBeNull()
  })

  it('avisa cuando no hay nada que corregir', () => {
    render(<ImproveSection companyId="c-0001" decisions={[]} metrics={[metrics[2]]} />)
    expect(screen.getByText(/no hay nada que corregir/i)).toBeInTheDocument()
  })
})
