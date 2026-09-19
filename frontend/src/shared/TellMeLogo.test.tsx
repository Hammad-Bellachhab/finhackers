import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TellMeLogo } from './TellMeLogo'

describe('TellMeLogo', () => {
  it('es decorativo y respeta el tamaño', () => {
    const { container } = render(<TellMeLogo size={42} />)
    const logo = container.querySelector('.tellme-logo') as HTMLElement
    expect(logo).toHaveAttribute('aria-hidden', 'true')
    expect(logo.style.width).toBe('42px')
    expect(logo.style.height).toBe('42px')
  })
})
