import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ThemeDatePicker } from './ThemeDatePicker'

describe('ThemeDatePicker', () => {
  it('uses a themed dialog instead of a native date input and returns the selected date', () => {
    const onChange = vi.fn()
    const { container } = render(
      <ThemeDatePicker
        label="购买日期"
        value="2026-07-19"
        max="2026-07-20"
        onChange={onChange}
      />,
    )

    expect(container.querySelector('input[type="date"]')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '购买日期：2026年7月19日' }))

    const dialog = screen.getByRole('dialog', { name: '选择购买日期' })
    expect(within(dialog).getAllByRole('button', { name: /\d{4}年\d+月\d+日/ })).toHaveLength(42)
    const selectedDate = within(dialog).getByRole('button', { name: '2026年7月19日' })
    expect(selectedDate).toHaveClass('selected')
    expect(selectedDate.querySelector('svg')).not.toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: '2026年7月20日' }))
    expect(onChange).toHaveBeenCalledWith('2026-07-20')
    expect(screen.queryByRole('dialog', { name: '选择购买日期' })).not.toBeInTheDocument()
  })

  it('enforces date limits and supports clearing an optional value', () => {
    const onChange = vi.fn()
    render(
      <ThemeDatePicker
        label="到期日"
        value="2026-07-19"
        min="2026-07-18"
        max="2026-07-20"
        onChange={onChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '到期日：2026年7月19日' }))
    const dialog = screen.getByRole('dialog', { name: '选择到期日' })

    expect(within(dialog).getByRole('button', { name: '2026年7月17日' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: '2026年7月20日' })).toBeEnabled()

    fireEvent.click(within(dialog).getByRole('button', { name: '清除' }))
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('closes from the Android back bridge without changing the value', () => {
    const onChange = vi.fn()
    render(
      <ThemeDatePicker label="开始日期" value="" onChange={onChange} />,
    )

    fireEvent.click(screen.getByRole('button', { name: '开始日期：选择日期' }))
    expect(screen.getByRole('dialog', { name: '选择开始日期' })).toBeInTheDocument()

    fireEvent(window, new Event('zhiwu:close-date-picker'))
    expect(screen.queryByRole('dialog', { name: '选择开始日期' })).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})
