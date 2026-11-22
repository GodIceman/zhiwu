import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { Asset } from './types'

const storage = vi.hoisted(() => ({
  loadAssets: vi.fn(), loadSettings: vi.fn(), saveAsset: vi.fn(async () => undefined),
  saveAssets: vi.fn(async () => undefined), saveSettings: vi.fn(async () => undefined),
  deleteAsset: vi.fn(async () => undefined), replaceAllData: vi.fn(async () => undefined),
  replaceAssets: vi.fn(async () => undefined),
}))

vi.mock('./lib/storage', () => ({
  ...storage,
  defaultSettings: { dailyCostMode: 'inclusive', theme: 'system', hasSeededDemoData: true, customSubcategories: [] },
}))
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(async () => ({ remove: vi.fn() })), exitApp: vi.fn() } }))
vi.mock('@capacitor/splash-screen', () => ({ SplashScreen: { hide: vi.fn(async () => undefined) } }))
vi.mock('@capacitor/status-bar', () => ({ Style: { Dark: 'DARK', Light: 'LIGHT' }, StatusBar: {
  setOverlaysWebView: vi.fn(async () => undefined), setBackgroundColor: vi.fn(async () => undefined), setStyle: vi.fn(async () => undefined),
} }))

const base: Asset = {
  id: 'item', name: '测试物品', kind: 'item', category: '数码', subcategory: '手机',
  valueTrackingEnabled: true, purchasePriceCny: 100, purchaseDate: '2026-11-01',
  photoDataUrl: '', note: '', createdAt: '', updatedAt: '',
}

describe('date and legacy service regressions', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 3, 12))
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1 })
    storage.saveAsset.mockClear()
    storage.loadSettings.mockResolvedValue({ dailyCostMode: 'inclusive', theme: 'system', hasSeededDemoData: true, customSubcategories: [] })
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('refreshes costs and countdowns after returning to the app on a later day', async () => {
    storage.loadAssets.mockResolvedValue([base, {
      ...base, id: 'service', kind: 'service', name: '测试服务', billingMode: 'monthly',
      serviceAmountCny: 30, billingCycle: 'monthly', nextEventDate: '2026-11-05', autoRenew: true,
    }])
    const { container } = render(<App />)
    await screen.findByRole('heading', { name: '拥有时长' }, { timeout: 2500 })
    const itemPage = container.querySelector('#home-mode-item-page') as HTMLElement
    expect(within(itemPage).getByRole('button', { name: /测试物品，拥有 3 天/ })).toBeInTheDocument()
    vi.setSystemTime(new Date(2026, 10, 4, 12))
    fireEvent.focus(window)
    expect(within(itemPage).getByRole('button', { name: /测试物品，拥有 4 天/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /服务/ }))
    expect(screen.getByText('1天后')).toBeInTheDocument()
  })

  it('confirms an added item only after it has been saved', async () => {
    storage.loadAssets.mockResolvedValue([base])
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '新增物品' }, { timeout: 2500 }))
    const form = screen.getByRole('dialog', { name: '新增物品' })
    fireEvent.change(within(form).getByPlaceholderText('例如工作电脑、通勤耳机'), { target: { value: '新物品' } })
    fireEvent.click(within(form).getByRole('switch', { name: /计算日均成本/ }))
    fireEvent.click(within(form).getByRole('button', { name: '保存' }))
    expect(await screen.findByRole('status')).toHaveTextContent('已添加')
    expect(storage.saveAsset).toHaveBeenCalledWith(expect.objectContaining({ name: '新物品' }))
  })

  it('keeps the form open and does not show success when saving fails', async () => {
    storage.loadAssets.mockResolvedValue([base])
    storage.saveAsset.mockRejectedValueOnce(new Error('storage failed'))
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '新增物品' }, { timeout: 2500 }))
    const form = screen.getByRole('dialog', { name: '新增物品' })
    fireEvent.change(within(form).getByPlaceholderText('例如工作电脑、通勤耳机'), { target: { value: '新物品' } })
    fireEvent.click(within(form).getByRole('switch', { name: /计算日均成本/ }))
    fireEvent.click(within(form).getByRole('button', { name: '保存' }))
    expect(await within(form).findByText(/保存失败/)).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it.each([
    ['weekly', '周付'],
    ['quarterly', '季付'],
    ['custom', '自定义'],
  ] as const)('preserves a legacy %s subscription and original renewal date while editing', async (cycle, label) => {
    const legacy: Asset = {
      ...base, id: 'legacy', kind: 'service', name: '旧订阅', billingMode: 'subscription',
      serviceCategory: '其他', serviceAmountCny: 120, billingCycle: cycle,
      nextEventDate: '2026-01-01', autoRenew: true, purchaseDate: '',
    }
    storage.loadAssets.mockResolvedValue([legacy])
    render(<App />)
    const serviceTab = await screen.findByRole('tab', { name: /服务/ }, { timeout: 2500 })
    fireEvent.click(serviceTab)
    fireEvent.click(screen.getByRole('button', { name: /旧订阅，/ }))
    const detail = screen.getByRole('dialog', { name: '服务详情' })
    fireEvent.click(within(detail).getByRole('button', { name: '编辑' }))
    const form = screen.getByRole('dialog', { name: '编辑服务' })
    expect(within(form).getByRole('button', { name: `周期订阅（${label}）` })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.change(within(form).getByPlaceholderText('例如 AI 助手、音乐会员'), { target: { value: '更新名称' } })
    fireEvent.click(within(form).getByRole('button', { name: '保存' }))
    await waitFor(() => expect(storage.saveAsset).toHaveBeenCalled())
    expect(storage.saveAsset).toHaveBeenCalledWith(expect.objectContaining({
      name: '更新名称', billingMode: 'subscription', billingCycle: cycle,
      serviceAmountCny: 120, nextEventDate: '2026-01-01', autoRenew: true,
    }))
    expect(await screen.findByRole('status')).toHaveTextContent('已保存')
  })

  it.each([
    ['fixed', '固定期限', 120],
    ['credit', '额度包', 120],
    ['usage', '按量计费', 0],
  ] as const)('preserves legacy %s billing when only the name changes', async (mode, label, amount) => {
    storage.loadAssets.mockResolvedValue([{
      ...base, id: 'legacy', kind: 'service', name: '旧服务', billingMode: mode,
      serviceCategory: '其他', serviceAmountCny: amount, billingCycle: 'custom',
      nextEventDate: '2026-12-01', autoRenew: false,
    }])
    render(<App />)
    fireEvent.click(await screen.findByRole('tab', { name: /服务/ }, { timeout: 2500 }))
    fireEvent.click(screen.getByRole('button', { name: /旧服务，/ }))
    fireEvent.click(within(screen.getByRole('dialog', { name: '服务详情' })).getByRole('button', { name: '编辑' }))
    const form = screen.getByRole('dialog', { name: '编辑服务' })
    expect(within(form).getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.change(within(form).getByPlaceholderText('例如 AI 助手、音乐会员'), { target: { value: '更新名称' } })
    fireEvent.click(within(form).getByRole('button', { name: '保存' }))
    await waitFor(() => expect(storage.saveAsset).toHaveBeenCalledWith(expect.objectContaining({
      name: '更新名称', billingMode: mode, billingCycle: 'custom',
      serviceAmountCny: amount, nextEventDate: '2026-12-01', autoRenew: false,
    })))
  })
})
