import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TellMeLogo } from './TellMeLogo'

describe('TellMeLogo', () => {
  it('renders without crashing and is aria-hidden', () => {
    const { container } = render(<TellMeLogo />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    // Debería tener los 5 rectángulos redondeados de la estrella oficial de TellMe
    const rects = container.querySelectorAll('rect')
    expect(rects).toHaveLength(5)
  })

  it('respects custom size and strokeWidth props', () => {
    const { container } = render(<TellMeLogo size={42} strokeWidth={8} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '42')
    expect(svg).toHaveAttribute('height', '42')

    const rects = container.querySelectorAll('rect')
    rects.forEach((rect) => {
      expect(rect).toHaveAttribute('stroke-width', '8')
    })
  })
})
