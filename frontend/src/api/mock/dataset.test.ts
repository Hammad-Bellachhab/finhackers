import { describe, expect, it } from 'vitest'
import { buildDataset } from './dataset'

describe('buildDataset', () => {
  const data = buildDataset()

  it('genera 1286 empresas, como el dataset real', () => {
    expect(data).toHaveLength(1286)
  })

  it('es determinista entre llamadas', () => {
    const otra = buildDataset()
    expect(otra[0].score.score).toBe(data[0].score.score)
    expect(otra[500].score.name).toBe(data[500].score.name)
  })

  it('cada empresa tiene 24 meses de historia y un score en rango', () => {
    for (const c of data.slice(0, 50)) {
      expect(c.score.series).toHaveLength(24)
      expect(c.score.score).toBeGreaterThanOrEqual(0)
      expect(c.score.score).toBeLessThanOrEqual(100)
    }
  })

  it('separa nivel de trayectoria: hay empresas sanas que estan cayendo', () => {
    const torciendose = data.filter((c) => c.score.band === 'healthy' && c.score.trend === 'down')
    expect(torciendose.length).toBeGreaterThan(0)
  })

  it('cubre las dos caras: hay empresas subiendo y bajando', () => {
    expect(data.some((c) => c.score.trend === 'up')).toBe(true)
    expect(data.some((c) => c.score.trend === 'down')).toBe(true)
  })

  it('marca un subconjunto como holdout, entre 60 y 80 empresas', () => {
    const held = data.filter((c) => c.score.heldOut)
    expect(held.length).toBeGreaterThanOrEqual(60)
    expect(held.length).toBeLessThanOrEqual(80)
  })

  it('distingue baches de deterioros estructurales', () => {
    expect(data.some((c) => c.forecast.stability === 'dip')).toBe(true)
    expect(data.some((c) => c.forecast.stability === 'structural')).toBe(true)
  })

  it('las empresas que se tuercen traen deteccion anticipada medida', () => {
    const conDeteccion = data.filter((c) => c.forecast.detection !== null)
    expect(conDeteccion.length).toBeGreaterThan(0)
    for (const c of conDeteccion.slice(0, 20)) {
      expect(c.forecast.detection!.monthsAhead).toBeGreaterThan(0)
    }
  })

  it('cada empresa trae al menos una decision accionable', () => {
    for (const c of data.slice(0, 100)) {
      expect(c.decisions.length).toBeGreaterThan(0)
    }
  })
})
