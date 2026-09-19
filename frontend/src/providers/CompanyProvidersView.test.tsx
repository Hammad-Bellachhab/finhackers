import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { getProviders } from '../api'
import type { Providers, ProviderCompany } from '../api/types'
import { companyIndex, CompanyProvidersView } from './CompanyProvidersView'

vi.mock('../api', { spy: true })

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

const providers: Providers = {
  month: '2026-08',
  totals: { providers: 1, companies: 2, connectors: 1, products: 2 },
  providers: [
    {
      name: 'BBVA', kind: 'banco', services: ['bbva'], companies: 2, products: 2,
      types: [{ type: 'checking', n: 2 }],
      bands: { 'sólida': 0, sana: 2, vigilar: 0, riesgo: 0 },
      meanHealth: 80, riskShare: 0, slipping: 0, improving: 0, granted: 0, outstanding: 0,
      rows: [empresa(1, 80), { ...empresa(999, 80), name: 'Acería del Norte' }],
    },
  ],
}

describe('CompanyProvidersView', () => {
  it('cambia de empresa buscando por nombre, sin desplegable plano', async () => {
    vi.mocked(getProviders).mockResolvedValue(providers)
    const onSelect = vi.fn()
    render(<CompanyProvidersView companyId="c-1" onSelect={onSelect} />)

    // Igual que el buscador de Empresa: empieza vacío, no enseña la empresa activa.
    const buscador = await screen.findByLabelText('Empresa')
    expect(buscador).toHaveValue('')

    await userEvent.type(buscador, 'Acería del Norte · c-999')
    expect(onSelect).toHaveBeenCalledWith('c-999')
    expect(buscador).toHaveValue('')   // se vacía otra vez tras elegir
  })
})
