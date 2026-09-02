import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(async () => ({ remove: vi.fn() })),
    exitApp: vi.fn(),
  },
}))

vi.mock('@capacitor/splash-screen', () => ({
  SplashScreen: { hide: vi.fn(async () => undefined) },
}))

vi.mock('@capacitor/status-bar', () => ({
  Style: { Dark: 'DARK', Light: 'LIGHT' },
  StatusBar: {
    setOverlaysWebView: vi.fn(async () => undefined),
    setBackgroundColor: vi.fn(async () => undefined),
    setStyle: vi.fn(async () => undefined),
  },
}))

describe('App startup', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })))
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
  })

  it('hydrates into the primary navigation instead of a blank screen', async () => {
    const { container } = render(<App />)

    expect(container.querySelector('.app-shell')).toBeInTheDocument()
    await waitFor(
      () => expect(container.querySelector('.bottom-nav')).toBeInTheDocument(),
      { timeout: 2500 },
    )
    expect(container.querySelector('.screen')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '拥有时长' })).toBeInTheDocument()
    expect(container.querySelector('.timeline-heading svg')).not.toBeInTheDocument()
    expect(container.querySelectorAll('.home-mode-page')).toHaveLength(2)
    expect(container.querySelector('.home-mode-carousel')).toBeInTheDocument()
    expect(screen.getByText('累计投入')).toBeInTheDocument()
    expect(screen.getByText('近一年投入')).toBeInTheDocument()
  })

  it('exposes services in the list and remembers the home mode', async () => {
    const { container } = render(<App />)

    await screen.findByRole('heading', { name: '拥有时长' }, { timeout: 2500 })
    const itemTimeline = container.querySelector('#home-mode-item-page .timeline-scroll')
    const homeHost = container.querySelector<HTMLElement>('.home-view-host')
    const homeCarousel = container.querySelector<HTMLElement>('.home-mode-carousel')
    expect(itemTimeline).toBeInTheDocument()
    expect(homeHost).toBeInTheDocument()
    expect(homeCarousel).toBeInTheDocument()
    Object.defineProperty(homeCarousel, 'clientWidth', { configurable: true, value: 360 })
    fireEvent.click(screen.getByRole('tab', { name: /服务/ }))
    await waitFor(() => expect(homeCarousel?.scrollLeft).toBe(360))
    expect(screen.getByRole('heading', { name: '续费日程' })).toBeInTheDocument()
    expect(screen.getByText('折合月均')).toBeInTheDocument()
    expect(screen.getByText('折合年均')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^清单$/ }))
    expect(homeHost).toHaveAttribute('hidden')
    expect(homeCarousel?.scrollLeft).toBe(360)
    const serviceListTab = screen.getByRole('tab', { name: /服务/ })
    fireEvent.click(serviceListTab)
    expect(screen.getByPlaceholderText('搜索服务、套餐或备注')).toBeInTheDocument()
    expect(screen.getByTitle('新增服务')).toBeInTheDocument()
    expect(container.querySelector('select')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '总览' }))
    expect(homeHost).not.toHaveAttribute('hidden')
    expect(homeCarousel?.scrollLeft).toBe(360)
    expect(screen.getByRole('tab', { name: /服务/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('uses the shared top bar and themed confirmation on settings', async () => {
    const { container } = render(<App />)

    await screen.findByRole('button', { name: '设置' }, { timeout: 2500 })
    fireEvent.click(screen.getByRole('button', { name: '设置' }))

    const topbar = container.querySelector('.topbar')
    expect(topbar).toBeInTheDocument()
    expect(within(topbar as HTMLElement).getByRole('heading', { name: '设置' })).toBeInTheDocument()
    expect(within(topbar as HTMLElement).queryByText('外观与数据')).not.toBeInTheDocument()
    expect(container.querySelector('.settings-title')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '清空示例' }))
    const dialog = screen.getByRole('alertdialog', { name: '清空示例数据？' })
    expect(within(dialog).getByText(/只会移除应用自带的示例/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('opens the matching add form from the service page and allows switching type', async () => {
    render(<App />)

    const serviceTab = await screen.findByRole('tab', { name: /服务/ }, { timeout: 2500 })
    fireEvent.click(serviceTab)
    expect(screen.getByRole('heading', { name: '续费日程' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTitle('新增服务')).toBeInTheDocument())
    fireEvent.click(screen.getByTitle('新增服务'))

    const dialog = screen.getByRole('dialog', { name: '新增服务' })
    const serviceNameLabel = within(dialog).getByText('服务名称')
    const serviceCategoryLabel = within(dialog).getByText('分类')
    const billingLabel = within(dialog).getByText('付费方式')

    expect(serviceNameLabel).toBeInTheDocument()
    expect(within(dialog).getByPlaceholderText('例如 AI 助手、音乐会员')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '其他' })).toHaveAttribute('aria-pressed', 'true')
    const serviceGlyphs = dialog.querySelectorAll<HTMLElement>('.service-category-glyph')
    expect(serviceGlyphs).toHaveLength(9)
    serviceGlyphs.forEach((glyph) => {
      expect(glyph.style.getPropertyValue('--catalog-glyph-size')).toBe('28px')
    })
    expect(serviceNameLabel.compareDocumentPosition(serviceCategoryLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(serviceCategoryLabel.compareDocumentPosition(billingLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    expect(within(dialog).getByText('每月费用')).toBeInTheDocument()
    expect(within(dialog).getByText(/下次扣款日/)).toBeInTheDocument()
    expect(within(dialog).getByText('自动续费')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '月付' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(within(dialog).getByRole('button', { name: '一次购买' }))
    expect(within(dialog).getByText('已付金额')).toBeInTheDocument()
    expect(within(dialog).getByText('购买日期')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: '免费' }))
    expect(within(dialog).queryByText('已付金额')).not.toBeInTheDocument()
    expect(within(dialog).getByText(/不填即长期/)).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: '切换为物品' }))
    const itemDialog = screen.getByRole('dialog', { name: '新增物品' })
    const itemNameLabel = within(itemDialog).getByText('物品名称')
    const itemCategoryLabel = within(itemDialog).getByText('分类')

    expect(within(itemDialog).getByPlaceholderText('例如工作电脑、通勤耳机')).toBeInTheDocument()
    expect(itemDialog.querySelector('.category-preview')).not.toBeInTheDocument()
    expect(itemNameLabel.compareDocumentPosition(itemCategoryLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const subcategoryPages = itemDialog.querySelectorAll('.subcategory-page')
    expect(subcategoryPages).toHaveLength(2)
    expect(subcategoryPages[0].querySelectorAll('.category-option')).toHaveLength(9)
    expect(subcategoryPages[1].querySelectorAll('.category-option')).toHaveLength(4)
  })
})
