import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Provider, ProviderCompany } from '../api/types'
import { tipos } from './parts'
import { ProvidersTable } from './ProvidersTable'

const empresa = (n: number, score: number, extra: Partial<ProviderCompany> = {}): ProviderCompany => ({
  companyId: `c-${n}`, name: `Empresa ${n}`, score, band: score >= 75 ? 'healthy' : 'risk',
  healthBand: score >= 75 ? 'sana' : 'riesgo', trend: 'flat', delta3m: 0,
  products: 1, types: [{ type: 'checking', n: 1 }], granted: 0, outstanding: 0, ...extra,
})

const santander: Provider = {
  name: 'Banco Santander Empresas', services: ['santander_emp'], companies: 3, products: 5,
  types: [{ type: 'checking', n: 3 }, { type: 'loan', n: 2 }],
  bands: { 'sólida': 0, sana: 2, vigilar: 0, riesgo: 1 },
  meanHealth: 66.7, riskShare: 0.3333, slipping: 1, improving: 0,
  granted: 500000, outstanding: 300000,
  rows: [empresa(1, 31), empresa(2, 80), empresa(3, 89)],
}

const paypal: Provider = {
  name: 'Paypal', services: ['paypal'], companies: 1, products: 1,
  types: [{ type: 'wallet', n: 1 }],
  bands: { 'sólida': 1, sana: 0, vigilar: 0, riesgo: 0 },
  meanHealth: 92, riskShare: 0, slipping: 0, improving: 1, granted: 0, outstanding: 0,
  rows: [empresa(9, 92, { healthBand: 'sólida', band: 'healthy' })],
}

/** Pequeño pero enfermo: es el que tiene que subir al ordenar por riesgo, salud o deuda. */
const march: Provider = {
  name: 'Banca March', services: ['bancamarch'], companies: 2, products: 4,
  types: [{ type: 'lineofcredit', n: 4 }],
  bands: { 'sólida': 0, sana: 0, vigilar: 1, riesgo: 1 },
  meanHealth: 40, riskShare: 0.5, slipping: 2, improving: 0,
  granted: 2000000, outstanding: 1000000,
  rows: [empresa(4, 30), empresa(5, 50)],
}

const pintar = (onSelect = () => {}) =>
  render(<ProvidersTable providers={[santander, paypal, march]} onSelect={onSelect} />)

describe('tipos', () => {
  it('traduce los tipos del ERP y resume el resto', () => {
    expect(tipos([{ type: 'checking', n: 3 }, { type: 'loan', n: 2 }])).toBe('3 cuenta · 2 préstamo')
    expect(tipos([{ type: 'checking', n: 1 }, { type: 'loan', n: 1 }, { type: 'card', n: 1 }, { type: 'tpv', n: 1 }]))
      .toBe('1 cuenta · 1 préstamo · 1 tarjeta · +1')
  })
})

describe('ProvidersTable', () => {
  it('lista los proveedores con su conector y su salud media', () => {
    pintar()
    expect(screen.getByText('Banco Santander Empresas')).toBeInTheDocument()
    expect(screen.getByText('santander_emp')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Salud 66,7 de 100, salud media/ })).toBeInTheDocument()
    expect(screen.getByText('33 % en riesgo')).toBeInTheDocument()
  })

  it('las empresas del proveedor solo salen al desplegarlo', async () => {
    pintar()
    expect(screen.queryByText('Empresa 1')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Banco Santander Empresas/ }))
    expect(screen.getByText('Empresa 1')).toBeInTheDocument()
    expect(screen.getByText('Empresa 3')).toBeInTheDocument()
  })

  it('cada empresa lleva su propio velocimetro con su puntuacion', async () => {
    pintar()
    await userEvent.click(screen.getByRole('button', { name: /Banco Santander Empresas/ }))
    expect(screen.getByRole('img', { name: 'Salud 31 de 100, banda riesgo' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Salud 80 de 100, banda sana' })).toBeInTheDocument()
    expect(screen.getByText('31')).toBeInTheDocument()
  })

  it('abre la ficha de la empresa al pulsarla', async () => {
    const onSelect = vi.fn()
    pintar(onSelect)
    await userEvent.click(screen.getByRole('button', { name: /Banco Santander Empresas/ }))
    await userEvent.click(screen.getByRole('button', { name: /Empresa 2/ }))
    expect(onSelect).toHaveBeenCalledWith('c-2')
  })

  it('busca por nombre de banco y por conector', async () => {
    pintar()
    const buscador = screen.getByLabelText('Buscar proveedor o conector')
    await userEvent.type(buscador, 'paypal')
    expect(screen.getByText('Paypal')).toBeInTheDocument()
    expect(screen.queryByText('Banco Santander Empresas')).not.toBeInTheDocument()

    await userEvent.clear(buscador)
    await userEvent.type(buscador, 'santander_emp')
    expect(screen.getByText('Banco Santander Empresas')).toBeInTheDocument()
    expect(screen.queryByText('Paypal')).not.toBeInTheDocument()
  })

  it('deja ver solo los proveedores que prestan dinero', async () => {
    pintar()
    await userEvent.click(screen.getByRole('button', { name: /Solo con financiación/ }))
    expect(screen.getByText('Banco Santander Empresas')).toBeInTheDocument()
    expect(screen.queryByText('Paypal')).not.toBeInTheDocument()
  })

  it('aparta la cola de bancos con una o dos empresas', async () => {
    pintar()
    await userEvent.click(screen.getByRole('button', { name: /Desde 10 empresas/ }))
    expect(screen.getByText('Ningún proveedor cumple ese filtro.')).toBeInTheDocument()
  })

  it('ordena por el riesgo de la cartera del proveedor, no por su tamaño', async () => {
    pintar()
    const primero = () => screen.getAllByRole('row')[1].textContent ?? ''
    expect(primero()).toContain('Banco Santander Empresas')

    for (const orden of ['salud', 'riesgo', 'deuda', 'torciendose']) {
      await userEvent.selectOptions(screen.getByLabelText('Ordenar por'), orden)
      expect(primero()).toContain('Banca March')
    }
  })
})
