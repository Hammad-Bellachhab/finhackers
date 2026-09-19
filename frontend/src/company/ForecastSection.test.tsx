import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CompanyScore, Forecast } from '../api/types'
import { ForecastSection } from './ForecastSection'

const serie = Array.from({ length: 24 }, (_, i) => ({
  month: `2025-${String((i % 12) + 1).padStart(2, '0')}`, score: Math.round(80 - i * 0.5),
}))

const score: CompanyScore = {
  companyId: 'c-1', name: 'Velasco Industrial', score: 68, band: 'healthy', trend: 'down',
  delta1m: -3, delta3m: -9, series: serie, drivers: [], metrics: [], heldOut: false,
}

const estructural: Forecast = {
  companyId: 'c-1',
  horizon: [{ month: '2026-10', score: 66 }, { month: '2026-11', score: 64 }],
  bandLow: [{ month: '2026-10', score: 63 }, { month: '2026-11', score: 60 }],
  bandHigh: [{ month: '2026-10', score: 69 }, { month: '2026-11', score: 68 }],
  stability: 'structural',
  stabilityNote: 'El deterioro es estructural: lleva varios meses en la misma dirección.',
  detection: { detectedAt: '2026-04', evidentAt: '2026-09', monthsAhead: 5 },
  basis: {
    paths: 2000, neighbours: 358, companies: 208, interval: 80,
    coverage: 0.809, probDrop5: 0.26, probRisk: 0.04,
  },
}

describe('ForecastSection', () => {
  it('mide la anticipacion en meses', () => {
    render(<ForecastSection score={score} forecast={estructural} />)
    expect(screen.getByText(/5 meses antes/i)).toBeInTheDocument()
    expect(screen.getByText(/abr 2026/)).toBeInTheDocument()
    expect(screen.getByText(/sep 2026/)).toBeInTheDocument()
  })

  it('distingue el deterioro estructural', () => {
    render(<ForecastSection score={score} forecast={estructural} />)
    expect(screen.getByText('Deterioro estructural')).toBeInTheDocument()
  })

  it('marca el bache y desaconseja actuar', () => {
    const bache: Forecast = {
      ...estructural, stability: 'dip',
      stabilityNote: 'Es un bache puntual, no un deterioro. No hace falta actuar.',
      detection: null,
    }
    render(<ForecastSection score={score} forecast={bache} />)
    expect(screen.getByText('Bache puntual')).toBeInTheDocument()
    expect(screen.getByText(/no hace falta actuar/i)).toBeInTheDocument()
  })

  it('dice de donde sale la banda, con los numeros del motor', () => {
    const { container } = render(<ForecastSection score={score} forecast={estructural} />)
    // El texto va partido en varios nodos (numeros interpolados), asi que se lee el parrafo entero.
    const nota = container.querySelector('.forecast-basis')?.textContent ?? ''
    expect(nota).toMatch(/El 26\s% de las trayectorias simuladas pierde más de 5 puntos/)
    expect(nota).toMatch(/el 4\s% acaba en riesgo/)
    expect(nota).toMatch(/2000 trayectorias sorteadas entre 208 empresas/)
    expect(nota).toMatch(/el 81\s% de lo que pasó cayó dentro/)
  })

  it('no ensena la nota si el motor no la manda (modo demo)', () => {
    const sinBase: Forecast = { ...estructural, basis: undefined }
    const { container } = render(<ForecastSection score={score} forecast={sinBase} />)
    expect(container.querySelector('.forecast-basis')).toBeNull()
  })

  it('no inventa anticipacion cuando no la hay', () => {
    const sinDeteccion: Forecast = { ...estructural, detection: null }
    render(<ForecastSection score={score} forecast={sinDeteccion} />)
    expect(screen.queryByText(/meses antes/i)).not.toBeInTheDocument()
  })
})
