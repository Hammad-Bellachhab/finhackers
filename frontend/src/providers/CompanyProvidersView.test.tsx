import { describe, expect, it } from 'vitest'
import type { Providers, ProviderCompany } from '../api/types'
import { companyIndex } from './CompanyProvidersView'

const empresa = (n: number, score: number): ProviderCompany => ({
  companyId: `c-${n}`, name: `Empresa ${n}`, score, band: 'risk', healthBand: 'riesgo',
  trend: 'flat', delta3m: 0, products: 1, types: [{ type: 'checking', n: 1 }], granted: 0, outstanding: 0,
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
