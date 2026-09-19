const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function formatMoney(value: number, short = false): string {
  if (short && Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} M€`
  }
  if (short && Math.abs(value) >= 1_000) {
    return `${Math.round(value / 1000).toLocaleString('es-ES')} k€`
  }
  return `${Math.round(value).toLocaleString('es-ES')} €`
}

export const formatDays = (v: number): string => `${Math.round(v)} d`

export const formatRatio = (v: number): string =>
  v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const formatPct = (v: number): string => `${Math.round(v * 100)} %`

export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${MESES[m - 1]} ${y}`
}
