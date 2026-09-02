import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { InsightBulbIcon } from './insight-bulb-icon'

describe('InsightBulbIcon', () => {
  it('renders three separated inspiration rays above the bulb', () => {
    const { container } = render(<InsightBulbIcon />)
    const icon = container.querySelector('svg')

    expect(icon).toHaveAttribute('width', '21')
    expect(icon).toHaveAttribute('height', '21')
    expect(icon).toHaveAttribute('viewBox', '0 -1.5 24 24')
    expect(container.querySelectorAll('path')).toHaveLength(4)
    expect(container.querySelector('path')?.getAttribute('d')).toBe(
      'M12 -0.45V1M4.55 1.95l1.2 1.2M18.25 3.15l1.2-1.2',
    )
    expect(icon).toHaveAttribute('stroke', 'currentColor')
  })
})
