import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScoreLine, yDomain } from './ScoreLine'

describe('yDomain', () => {
  it('se adapta a los datos recibidos, con margen', () => {
    expect(yDomain([{ month: '2026-01', score: 40 }, { month: '2026-02', score: 60 }]))
      .toEqual([30, 70])
  })

  it('no se sale de 0-100 aunque los datos esten en los extremos', () => {
    expect(yDomain([{ month: '2026-01', score: 2 }, { month: '2026-02', score: 98 }]))
      .toEqual([0, 100])
  })

  it('aguanta una serie vacia sin romper', () => {
    expect(yDomain([])).toEqual([0, 100])
  })
})

describe('ScoreLine', () => {
  it('se renderiza con una serie de datos', () => {
    const { container } = render(
      <ScoreLine series={[
        { month: '2026-01', score: 40 },
        { month: '2026-02', score: 45 },
      ]} />,
    )
    expect(container.querySelector('.score-line')).toBeTruthy()
  })

  it('acepta proyeccion y banda sin romper', () => {
    const { container } = render(
      <ScoreLine
        series={[{ month: '2026-01', score: 40 }, { month: '2026-02', score: 45 }]}
        projection={[{ month: '2026-03', score: 47 }]}
        bandLow={[{ month: '2026-03', score: 44 }]}
        bandHigh={[{ month: '2026-03', score: 50 }]}
        markers={[{ month: '2026-01', label: 'Detectado' }]}
      />,
    )
    expect(container.querySelector('.score-line')).toBeTruthy()
  })
})
