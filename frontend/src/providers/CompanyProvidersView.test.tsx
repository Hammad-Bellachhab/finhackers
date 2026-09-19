import { describe, expect, it } from 'vitest'
import type { Providers, ProviderCompany } from '../api/types'
import { companyIndex, percentile } from './CompanyProvidersView'

const empresa = (n: number, score: number): ProviderCompany => ({
  companyId: `c-${n}`, name: `Empresa ${n}`, score, band: 'risk', healthBand: 'riesgo',
  trend: 'flat', delta3m: 0, products: 1, types: [{ type: 'checking', n: 1 }], granted: 0, outstanding: 0,
})

const rows = [empresa(1, 20), empresa(2, 50), empresa(3, 70), empresa(4, 90), empresa(5, 95)]

describe('percentile', () => {
  it('sitúa a la empresa entre las del banco, de peor a mejor', () => {
    expect(percentile(rows, 'c-1')).toBe(0)     // la peor del banco
    expect(percentile(rows, 'c-3')).toBe(50)    // dos peores de cuatro
    expect(percentile(rows, 'c-5')).toBe(100)   // la mejor
  })

  it('no divide por cero cuando la empresa está sola en su banco', () => {
    expect(percentile([empresa(1, 42)], 'c-1')).toBe(0)
    expect(percentile(rows, 'no-existe')).toBe(0)
  })
})

describe('companyIndex', () => {
  it('lista cada empresa una sola vez y por nombre', () => {
    const data = {
      month: '2026-08',
      totals: { providers: 2, companies: 2, connectors: 2, products: 3 },
      providers: [
        { name: 'B', rows: [empresa(2, 50), empresa(1, 20)] },
        { name: 'A', rows: [empresa(1, 20)] },   // COMP repetida en dos bancos
      ],
    } as unknown as Providers
    expect(companyIndex(data)).toEqual([
      { id: 'c-1', name: 'Empresa 1' },
      { id: 'c-2', name: 'Empresa 2' },
    ])
  })
})
