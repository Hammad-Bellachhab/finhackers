import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TellMeLogo } from './TellMeLogo'

describe('TellMeLogo', () => {
  it('pinta la estrella de un solo trazo y es decorativa', () => {
    const { container } = render(<TellMeLogo size={42} strokeWidth={8} />)
    const svg = container.querySelector('svg')!
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('width', '42')
    const path = container.querySelectorAll('path')
    expect(path).toHaveLength(1)
    expect(path[0]).toHaveAttribute('stroke-width', '8')
    expect(path[0]).toHaveAttribute('stroke-linejoin', 'round')
  })

  it('cada logo usa su propio degradado (varios en la misma página)', () => {
    const { container } = render(<><TellMeLogo /><TellMeLogo /></>)
    const ids = [...container.querySelectorAll('linearGradient')].map((g) => g.id)
    expect(new Set(ids).size).toBe(2)
  })
})
