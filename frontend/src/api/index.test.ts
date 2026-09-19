import { describe, expect, it } from 'vitest'
import {
  getAlerts, getCompanyScore, getDecisions, getEvidence, getForecast, getPortfolio, simulate,
} from './index'

describe('fachada de la API', () => {
  it('devuelve el score de una empresa por id', async () => {
    const s = await getCompanyScore('c-0001')
    expect(s.companyId).toBe('c-0001')
    expect(s.series).toHaveLength(24)
  })

  it('lanza un error legible si la empresa no existe', async () => {
    await expect(getCompanyScore('no-existe')).rejects.toThrow('Empresa no encontrada')
  })

  it('devuelve la cartera completa con sus recuentos', async () => {
    const p = await getPortfolio()
    expect(p.rows).toHaveLength(1286)
    expect(p.counts.healthy + p.counts.stable + p.counts.risk).toBe(1286)
    expect(p.counts.heldOut).toBeGreaterThanOrEqual(60)
  })

  it('la simulacion es determinista y mejora el score al acercar el DSO a su referencia', async () => {
    const base = await getCompanyScore('c-0002')
    const dso = base.metrics.find((m) => m.id === 'dso')!.value
    const a = await simulate('c-0002', 'dso', dso - 15)
    const b = await simulate('c-0002', 'dso', dso - 15)
    expect(a.scoreDelta).toBe(b.scoreDelta)
    expect(a.scoreDelta).toBeGreaterThan(0)
  })

  it('devuelve previsiones, decisiones, alertas y evidencia', async () => {
    expect((await getForecast('c-0001')).horizon).toHaveLength(6)
    expect((await getDecisions('c-0001')).length).toBeGreaterThan(0)
    expect((await getAlerts()).length).toBeGreaterThan(0)
    expect((await getEvidence()).holdout.companies).toBeGreaterThanOrEqual(60)
  })

  it('las alertas cubren las dos direcciones', async () => {
    const alerts = await getAlerts()
    expect(alerts.some((a) => a.kind === 'improving')).toBe(true)
    expect(alerts.some((a) => a.kind === 'slipping')).toBe(true)
  })
})
