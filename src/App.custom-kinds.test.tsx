import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { itemCategoryIconUrls } from './icons/category-icon-catalog'
import type { Asset, Settings } from './types'

const storage = vi.hoisted(() => ({
  loadAssets: vi.fn(), loadSettings: vi.fn(),
  saveAsset: vi.fn(async () => undefined), saveSettings: vi.fn(async () => undefined),
  updateCustomSubcategory: vi.fn(async () => undefined),
  deleteAsset: vi.fn(async () => undefined), replaceAllData: vi.fn(async () => undefined),
  clearDemoAssets: vi.fn(async () => []),
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

const settings: Settings = { dailyCostMode: 'inclusive', theme: 'system', hasSeededDemoData: true, customSubcategories: [] }
const base: Asset = {
  id: 'board-a', name: '第一块滑板', kind: 'item', category: '运动', subcategory: '滑板',
  valueTrackingEnabled: false, purchasePriceCny: 0, purchaseDate: '', photoDataUrl: '',
  note: '', createdAt: '', updatedAt: '',
}

describe('custom kinds with text badges', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1 })
    storage.loadAssets.mockResolvedValue([])
    storage.loadSettings.mockResolvedValue(settings)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('directs an old built-in name to its new category instead of saving a kind that moves on reload', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '新增物品' }, { timeout: 2500 }))
    const form = screen.getByRole('dialog', { name: '新增物品' })
    fireEvent.click(within(form).getByRole('button', { name: '日用' }))
    fireEvent.click(within(form).getByRole('button', { name: '自定义' }))
    const panel = within(form).getByRole('group', { name: '新增自定义种类' })
    fireEvent.change(within(panel).getByRole('textbox', { name: '种类名称' }), { target: { value: '平底锅' } })
    fireEvent.click(within(panel).getByRole('button', { name: '添加种类' }))
    expect(within(panel).getByText('平底锅已在家居中，请直接选择')).toBeInTheDocument()
    expect(storage.saveSettings).not.toHaveBeenCalled()
  })

  it('adds an uncovered kind by name and keeps its badge consistent in the list and detail', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '新增物品' }, { timeout: 2500 }))
    const form = screen.getByRole('dialog', { name: '新增物品' })
    fireEvent.click(within(form).getByRole('button', { name: '运动' }))
    fireEvent.click(within(form).getByRole('button', { name: '自定义' }))
    const panel = within(form).getByRole('group', { name: '新增自定义种类' })
    expect(within(panel).queryByRole('button', { name: /选择图标/ })).not.toBeInTheDocument()
    expect(within(panel).queryByRole('textbox', { name: '搜索图标' })).not.toBeInTheDocument()
    fireEvent.change(within(panel).getByRole('textbox', { name: '种类名称' }), { target: { value: '滑板' } })
    expect(panel.querySelector('.custom-kind-glyph')).toHaveTextContent('滑板')
    fireEvent.click(within(panel).getByRole('button', { name: '添加种类' }))
    await waitFor(() => expect(storage.saveSettings).toHaveBeenCalledWith(expect.objectContaining({
      customSubcategories: [{ category: '运动', name: '滑板', emoji: '📦' }],
    })))
    expect(await within(form).findByRole('button', { name: '滑板' })).toHaveClass('active')
    fireEvent.change(within(form).getByRole('textbox', { name: '物品名称' }), { target: { value: '通勤滑板' } })
    fireEvent.click(within(form).getByRole('switch', { name: /计算日均成本/ }))
    fireEvent.click(within(form).getByRole('button', { name: '保存' }))
    await waitFor(() => expect(storage.saveAsset).toHaveBeenCalledWith(expect.objectContaining({
      name: '通勤滑板', category: '运动', subcategory: '滑板',
    })))
    fireEvent.click(screen.getByRole('button', { name: '清单' }))
    const row = screen.getByRole('button', { name: /通勤滑板/ })
    expect(row.querySelector('.custom-kind-glyph')).toHaveTextContent('滑板')
    fireEvent.click(row)
    const detail = screen.getByRole('dialog', { name: '物品详情' })
    expect(detail.querySelector('.custom-kind-glyph')).toHaveTextContent('滑板')
    expect(within(detail).getByText('运动 / 滑板')).toBeInTheDocument()
  })

  it('renames matching item kinds together while preserving another category and the service', async () => {
    storage.loadAssets.mockResolvedValue([
      base,
      { ...base, id: 'board-b', name: '第二块滑板' },
      { ...base, id: 'other-board', category: '日用', name: '其他分类物品' },
      { ...base, id: 'service', kind: 'service', name: '滑板课程', serviceCategory: '学习教育', billingMode: 'free' },
    ])
    storage.loadSettings.mockResolvedValue({
      ...settings,
      customSubcategories: [
        { category: '运动', name: '滑板', emoji: '🛹', iconKey: 'football' },
        { category: '日用', name: '滑板', emoji: '🛹', iconKey: 'books' },
      ],
    })
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /^第一块滑板，/ }, { timeout: 2500 }))
    fireEvent.click(within(screen.getByRole('dialog', { name: '物品详情' })).getByRole('button', { name: '编辑' }))
    const form = screen.getByRole('dialog', { name: '编辑物品' })
    fireEvent.click(within(form).getByRole('button', { name: '编辑种类' }))
    const panel = within(form).getByRole('group', { name: '编辑自定义种类' })
    fireEvent.change(within(panel).getByRole('textbox', { name: '种类名称' }), { target: { value: '长板' } })
    fireEvent.click(within(panel).getByRole('button', { name: '保存种类' }))
    await waitFor(() => expect(storage.updateCustomSubcategory).toHaveBeenCalledWith(
      { category: '运动', name: '滑板' },
      { category: '运动', name: '长板', emoji: '🛹', iconKey: 'football' },
      expect.objectContaining({ customSubcategories: [
        { category: '运动', name: '长板', emoji: '🛹', iconKey: 'football' },
        { category: '日用', name: '滑板', emoji: '🛹', iconKey: 'books' },
      ] }),
    ))
    expect(await within(form).findByRole('button', { name: '长板' })).toHaveClass('active')
    fireEvent.click(within(form).getByRole('button', { name: '保存' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '编辑物品' })).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '清单' }))
    for (const name of ['第一块滑板', '第二块滑板']) {
      expect(screen.getByRole('button', { name: new RegExp(name) }).querySelector('.custom-kind-glyph')).toHaveTextContent('长板')
    }
    expect(screen.getByRole('button', { name: /其他分类物品/ }).querySelector('.custom-kind-glyph')).toHaveTextContent('滑板')
    fireEvent.click(screen.getByRole('tab', { name: /服务/ }))
    fireEvent.click(screen.getByRole('button', { name: /滑板课程/ }))
    const serviceDetail = screen.getByRole('dialog', { name: '服务详情' })
    expect(within(serviceDetail).getByRole('heading', { name: '滑板课程' })).toBeInTheDocument()
    expect(within(serviceDetail).getByText('服务分类').parentElement).toHaveTextContent('学习教育')
    expect(within(serviceDetail).getByText('付费方式').parentElement).toHaveTextContent('免费')
    expect(storage.saveAsset).toHaveBeenCalledTimes(1)
    expect(storage.saveAsset).toHaveBeenCalledWith(expect.objectContaining({ id: base.id, category: '运动', subcategory: '长板' }))
  })

  it('uses the approved GPU graphic for a formerly custom kind without locking the item name', async () => {
    storage.loadAssets.mockResolvedValue([{ ...base, id: 'gpu', name: '旧显卡', category: '数码', subcategory: '显卡' }])
    storage.loadSettings.mockResolvedValue({
      ...settings, customSubcategories: [{ category: '数码', name: '显卡', emoji: '✨', iconKey: 'football' }],
    })
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /^旧显卡，/ }, { timeout: 2500 }))
    const detail = screen.getByRole('dialog', { name: '物品详情' })
    expect(detail.querySelector<HTMLElement>('.item-category-glyph')?.style.getPropertyValue('--catalog-glyph-url'))
      .toBe(`url("${itemCategoryIconUrls['graphics-card']}")`)
    expect(detail.querySelector('.custom-kind-glyph')).not.toBeInTheDocument()
    fireEvent.click(within(detail).getByRole('button', { name: '编辑' }))
    const form = screen.getByRole('dialog', { name: '编辑物品' })
    expect(within(form).queryByRole('button', { name: '编辑种类' })).not.toBeInTheDocument()
    fireEvent.change(within(form).getByRole('textbox', { name: '物品名称' }), { target: { value: '工作显卡' } })
    fireEvent.click(within(form).getByRole('button', { name: '保存' }))
    await waitFor(() => expect(storage.saveAsset).toHaveBeenCalledWith(expect.objectContaining({
      id: 'gpu', name: '工作显卡', category: '数码', subcategory: '显卡',
    })))
    expect(storage.updateCustomSubcategory).not.toHaveBeenCalled()
  })
})
