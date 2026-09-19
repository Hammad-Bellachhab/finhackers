import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Gauge, arcPath, gaugePoint, healthBandOf } from './Gauge'

describe('gaugePoint', () => {
  it('recorre el semicirculo de izquierda a derecha', () => {
    expect(gaugePoint(0)).toEqual({ x: 10, y: 50 })
    expect(gaugePoint(50)).toEqual({ x: 50, y: 10 })
    expect(gaugePoint(100)).toEqual({ x: 90, y: 50 })
  })

  it('satura fuera de 0-100 en vez de dar la vuelta', () => {
    expect(gaugePoint(-20)).toEqual(gaugePoint(0))
    expect(gaugePoint(140)).toEqual(gaugePoint(100))
  })

  it('el arco arranca siempre en el extremo izquierdo', () => {
    expect(arcPath(35).startsWith('M 10 50 A 40 40 0 0 1 ')).toBe(true)
  })
})

describe('healthBandOf', () => {
  it('usa los umbrales del motor', () => {
    expect(healthBandOf(91)).toBe('sólida')
    expect(healthBandOf(90)).toBe('sólida')
    expect(healthBandOf(80)).toBe('sana')
    expect(healthBandOf(60)).toBe('vigilar')
    expect(healthBandOf(49.9)).toBe('riesgo')
  })
})

describe('Gauge', () => {
  it('dice la puntuacion y la banda a quien no ve la aguja', () => {
    render(<Gauge score={41.2} band="riesgo" />)
    expect(screen.getByRole('img', { name: 'Salud 41,2 de 100, banda riesgo' })).toBeInTheDocument()
  })

  it('deduce la banda cuando no se la pasan', () => {
    render(<Gauge score={95} />)
    expect(screen.getByRole('img', { name: /banda sólida/ })).toBeInTheDocument()
  })

  it('pinta la puntuacion dentro del velocimetro', () => {
    render(<Gauge score={68.4} band="vigilar" />)
    expect(screen.getByText('68,4')).toBeInTheDocument()
  })
})
