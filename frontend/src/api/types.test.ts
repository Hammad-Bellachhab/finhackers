import { describe, expect, it } from 'vitest'
import { isBand, type CompanyScore } from './types'

describe('contrato de la API', () => {
  it('reconoce las tres bandas de nivel y rechaza las trayectorias', () => {
    expect(isBand('healthy')).toBe(true)
    expect(isBand('stable')).toBe(true)
    expect(isBand('risk')).toBe(true)
    // 'improving' es trayectoria, no nivel: no debe colarse como banda
    expect(isBand('improving')).toBe(false)
  })

  it('un CompanyScore separa nivel de trayectoria', () => {
    const velasco: CompanyScore = {
      companyId: 'c-1', name: 'Velasco Industrial',
      score: 68, band: 'healthy', trend: 'down',
      delta1m: -3, delta3m: -9,
      series: [{ month: '2026-09', score: 68 }],
      drivers: [], metrics: [], heldOut: false,
    }
    // El ejemplo del brief: cae de 82 a 68 y sigue pareciendo sana.
    expect(velasco.band).toBe('healthy')
    expect(velasco.trend).toBe('down')
  })
})
