const MINUS = '−'
const NBSP = ' '

export function formatInt(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function formatDecimal(value: number, decimals = 1): string {
  return value.toFixed(decimals).replace('.', ',')
}

/** "2026-09-19" pasa a "19/09/2026". */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "2026-09" pasa a "sep 26". */
export function formatMonth(month: string): string {
  const [year, m] = month.split('-')
  return `${MONTHS_SHORT[Number(m) - 1] ?? m} ${String(year).slice(2)}`
}

export function formatSigned(value: number, decimals = 0): string {
  if (value === 0) return '0'
  const body = formatDecimal(Math.abs(value), decimals)
  return `${value > 0 ? '+' : MINUS}${body}`
}

export function formatEuros(value: number): string {
  return `${formatInt(value)}${NBSP}€`
}

export function formatPercent(fraction: number, decimals = 1): string {
  return `${formatDecimal(fraction * 100, decimals)}${NBSP}%`
}

export const COUNTRY_NAMES: Record<string, string> = { ES: 'España', PT: 'Portugal', FR: 'Francia', IT: 'Italia' }

export function countryName(code: string): string {
  return COUNTRY_NAMES[code] ?? code
}

export function bandLabel(band: 'bajo' | 'medio' | 'alto'): string {
  return band === 'alto' ? 'Alto' : band === 'medio' ? 'Medio' : 'Bajo'
}

const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "2026-09" pasa a "septiembre de 2026". */
export function formatMonthLong(month: string): string {
  const [year, m] = month.split('-')
  return `${MONTHS_LONG[Number(m) - 1] ?? m} de ${year}`
}

/** Importes de eje: 1.400.000 pasa a "1,4 M€"; 220.000 pasa a "220 k€". */
export function formatEurosCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${formatDecimal(value / 1_000_000, 1)}${NBSP}M€`
  if (Math.abs(value) >= 1_000) return `${formatInt(value / 1_000)}${NBSP}k€`
  return `${formatInt(value)}${NBSP}€`
}
