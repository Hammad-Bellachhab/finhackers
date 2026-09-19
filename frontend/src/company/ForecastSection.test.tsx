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

  it('no inventa anticipacion cuando no la hay', () => {
    const sinDeteccion: Forecast = { ...estructural, detection: null }
    render(<ForecastSection score={score} forecast={sinDeteccion} />)
    expect(screen.queryByText(/meses antes/i)).not.toBeInTheDocument()
  })
})
