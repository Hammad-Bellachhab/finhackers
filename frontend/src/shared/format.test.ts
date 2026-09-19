import { describe, expect, it } from 'vitest'
import { formatDays, formatMonth, formatMoney, formatPct, formatRatio } from './format'

describe('formato', () => {
  it('formatea euros sin decimales y con separador de miles', () => {
    expect(formatMoney(184000)).toBe('184.000 €')
    expect(formatMoney(25000)).toBe('25.000 €')
  })
  it('no agrupa los numeros de cuatro cifras, como manda el español', () => {
    expect(formatMoney(2500)).toBe('2500 €')
    expect(formatMoney(-2500)).toBe('-2500 €')
  })
  it('abrevia importes grandes', () => {
    expect(formatMoney(1250000, true)).toBe('1,3 M€')
    expect(formatMoney(184000, true)).toBe('184 k€')
  })
  it('formatea dias, ratios y porcentajes', () => {
    expect(formatDays(62)).toBe('62 d')
    expect(formatRatio(1.253)).toBe('1,25')
    expect(formatPct(0.82)).toBe('82 %')
  })
  it('convierte YYYY-MM en mes legible', () => {
    expect(formatMonth('2026-09')).toBe('sep 2026')
    expect(formatMonth('2025-01')).toBe('ene 2025')
  })
})
