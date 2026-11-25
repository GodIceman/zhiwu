import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CustomKindGlyph } from './category-icons'

describe('custom kind text badges', () => {
  it.each([
    ['  🛹滑 板车', '滑板'],
    ['🎮 GPU', 'GP'],
    ['e\u0301tui', 'ét'],
    ['𠮷野家', '𠮷野'],
    ['  ✨🛹 ', '物'],
    ['', '物'],
  ])('displays a short text mark for %s', (name, expected) => {
    render(<CustomKindGlyph name={name} />)
    expect(screen.getByText(expected)).toBeInTheDocument()
  })
})
