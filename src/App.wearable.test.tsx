import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { getSubcategoryDisplayName, getSubcategoryMeta } from './types'
import { normalizeAsset } from './lib/asset-normalization'
import type { Asset, CustomSubcategory } from './types'

const storage = vi.hoisted(() => ({
  loadAssets: vi.fn(), loadSettings: vi.fn(), saveAsset: vi.fn(async () => undefined),
  saveSettings: vi.fn(async () => undefined), deleteAsset: vi.fn(async () => undefined),
  replaceAllData: vi.fn(async () => undefined), clearDemoAssets: vi.fn(async () => []),
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

const item: Asset = {
  id: 'legacy', name: '历史物品', kind: 'item', category: '穿戴', subcategory: '首饰',
  valueTrackingEnabled: false, purchasePriceCny: 0, purchaseDate: '', photoDataUrl: '',
  note: '', createdAt: '', updatedAt: '',
}

describe('wearable categories', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1 })
    storage.saveAsset.mockClear()
    storage.loadSettings.mockResolvedValue({ dailyCostMode: 'inclusive', theme: 'system', hasSeededDemoData: true, customSubcategories: [] })
  })

  it('preserves original category and name while resolving each icon within its own category', () => {
    const custom: CustomSubcategory[] = [
      { category: '数码', name: '服装', emoji: '📦' },
      { category: '家电', name: '鞋靴', emoji: '📦' },
      ...(['鞋', '包', '眼镜', '腕表'] as const).flatMap((name) => [
        { category: '数码' as const, name, emoji: '📦' },
        { category: '家电' as const, name, emoji: '📦' },
      ]),
    ]
    expect(getSubcategoryMeta('服装', custom, '数码').iconKey).toBeUndefined()
    expect(getSubcategoryMeta('鞋靴', custom, '家电').iconKey).toBeUndefined()
    expect(getSubcategoryMeta('服装', custom, '穿戴').iconKey).toBe('clothing')
    expect(getSubcategoryMeta('鞋靴', custom, '穿戴').iconKey).toBe('shoes')
    expect(getSubcategoryMeta('箱包', custom, '穿戴').iconKey).toBe('bag')
    for (const name of ['鞋', '包', '眼镜', '腕表']) {
      expect(getSubcategoryMeta(name, custom, '数码').iconKey).toBeUndefined()
      expect(getSubcategoryMeta(name, custom, '家电').iconKey).toBeUndefined()
      expect(normalizeAsset({ ...item, category: '数码', subcategory: name })).toMatchObject({ category: '数码', subcategory: name })
    }
    expect(getSubcategoryDisplayName('数码', '鞋靴')).toBe('鞋靴')
    expect(getSubcategoryDisplayName('穿戴', '鞋靴')).toBe('鞋')
    expect(getSubcategoryDisplayName('穿戴', '箱包')).toBe('包')
    expect(normalizeAsset({ ...item, subcategory: '鞋靴' })).toMatchObject({ category: '穿戴', subcategory: '鞋靴' })
    expect(normalizeAsset({ ...item, category: '数码', subcategory: '服装' })).toMatchObject({ category: '数码', subcategory: '服装' })
  })

  it('adds and filters a wearable item without exposing the old jewellery option on a new form', async () => {
    storage.loadAssets.mockResolvedValue([])
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '新增物品' }, { timeout: 2500 }))
    const form = screen.getByRole('dialog', { name: '新增物品' })
    fireEvent.click(within(form).getByRole('button', { name: '穿戴' }))
    for (const label of ['服装', '鞋', '包', '眼镜', '腕表']) {
      expect(within(form).getByRole('button', { name: label })).toBeInTheDocument()
    }
    expect(within(form).queryByRole('button', { name: '首饰' })).not.toBeInTheDocument()
    fireEvent.click(within(form).getByRole('button', { name: '鞋' }))
    fireEvent.change(within(form).getByPlaceholderText('例如工作电脑、通勤耳机'), { target: { value: '一双鞋' } })
    fireEvent.click(within(form).getByRole('switch', { name: /计算日均成本/ }))
    fireEvent.click(within(form).getByRole('button', { name: '保存' }))
    await waitFor(() => expect(storage.saveAsset).toHaveBeenCalledWith(expect.objectContaining({
      category: '穿戴', subcategory: '鞋靴', name: '一双鞋',
    })))
    fireEvent.click(screen.getByRole('button', { name: '清单' }))
    fireEvent.click(screen.getByRole('button', { name: '穿戴' }))
    expect(screen.getByRole('button', { name: /一双鞋/ })).toBeInTheDocument()
  })

  it('keeps a historical jewellery item editable without changing its category', async () => {
    storage.loadAssets.mockResolvedValue([item])
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /历史物品，/ }, { timeout: 2500 }))
    fireEvent.click(within(screen.getByRole('dialog', { name: '物品详情' })).getByRole('button', { name: '编辑' }))
    const form = screen.getByRole('dialog', { name: '编辑物品' })
    expect(within(form).getByRole('button', { name: '首饰' })).toHaveClass('active')
    fireEvent.click(within(form).getByRole('button', { name: '保存' }))
    await waitFor(() => expect(storage.saveAsset).toHaveBeenCalledWith(expect.objectContaining({
      category: '穿戴', subcategory: '首饰', name: '历史物品',
    })))
  })

  it('keeps a legacy wearable custom name distinct from a similarly named built-in', async () => {
    storage.loadAssets.mockResolvedValue([{ ...item, subcategory: '鞋', name: '自定义鞋' }])
    storage.loadSettings.mockResolvedValue({
      dailyCostMode: 'inclusive', theme: 'system', hasSeededDemoData: true,
      customSubcategories: [{ category: '穿戴', name: '鞋', emoji: '📦' }],
    })
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /自定义鞋，/ }, { timeout: 2500 }))
    fireEvent.click(within(screen.getByRole('dialog', { name: '物品详情' })).getByRole('button', { name: '编辑' }))
    const form = screen.getByRole('dialog', { name: '编辑物品' })
    expect(within(form).getByRole('button', { name: '鞋（自定义）' })).toHaveClass('active')
    expect(within(form).getByRole('button', { name: '鞋' })).not.toHaveClass('active')
    fireEvent.click(within(form).getByRole('button', { name: '保存' }))
    await waitFor(() => expect(storage.saveAsset).toHaveBeenCalledWith(expect.objectContaining({
      category: '穿戴', subcategory: '鞋', name: '自定义鞋',
    })))
  })

  it('offers the five agreed categories and saves a new sport kind through list filtering', async () => {
    storage.loadAssets.mockResolvedValue([])
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '新增物品' }, { timeout: 2500 }))
    const form = screen.getByRole('dialog', { name: '新增物品' })
    expect(Array.from(form.querySelectorAll('.primary-tabs button')).map((button) => button.textContent)).toEqual(['数码', '家居', '穿戴', '运动', '日用'])
    fireEvent.click(within(form).getByRole('button', { name: '运动' }))
    expect(within(form).queryByRole('button', { name: '露营' })).not.toBeInTheDocument()
    expect(within(form).queryByRole('button', { name: '健身' })).not.toBeInTheDocument()
    fireEvent.click(within(form).getByRole('button', { name: '头灯' }))
    fireEvent.change(within(form).getByPlaceholderText('例如工作电脑、通勤耳机'), { target: { value: '夜跑头灯' } })
    fireEvent.click(within(form).getByRole('switch', { name: /计算日均成本/ }))
    fireEvent.click(within(form).getByRole('button', { name: '保存' }))
    await waitFor(() => expect(storage.saveAsset).toHaveBeenCalledWith(expect.objectContaining({ category: '运动', subcategory: '头灯', name: '夜跑头灯' })))
    fireEvent.click(screen.getByRole('button', { name: '清单' }))
    fireEvent.click(screen.getByRole('button', { name: '运动' }))
    expect(screen.getByRole('button', { name: /夜跑头灯/ })).toBeInTheDocument()
  })

  it('opens and saves a migrated pot in Home while preserving its purchase information', async () => {
    const migrated = normalizeAsset({ ...item, category: '日用', subcategory: '平底锅',
      name: '旧锅', valueTrackingEnabled: true, purchasePriceCny: 199, purchaseDate: '2026-02-01', note: '原备注' })
    storage.loadAssets.mockResolvedValue([migrated])
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '清单' }, { timeout: 2500 }))
    fireEvent.click(screen.getByRole('button', { name: '家居' }))
    fireEvent.click(screen.getByRole('button', { name: /旧锅/ }))
    const detail = screen.getByRole('dialog', { name: '物品详情' })
    expect(within(detail).getByText('家居 / 平底锅')).toBeInTheDocument()
    fireEvent.click(within(detail).getByRole('button', { name: '编辑' }))
    const form = screen.getByRole('dialog', { name: '编辑物品' })
    expect(within(form).getByRole('button', { name: '家居' })).toHaveClass('active')
    expect(within(form).getByRole('button', { name: '平底锅' })).toHaveClass('active')
    fireEvent.click(within(form).getByRole('button', { name: '保存' }))
    await waitFor(() => expect(storage.saveAsset).toHaveBeenCalledWith(expect.objectContaining({
      id: item.id, category: '家电', subcategory: '平底锅', purchasePriceCny: 199, purchaseDate: '2026-02-01', note: '原备注',
    })))
  })

  it('finds a historical hidden category in Daily and keeps it editable with its custom icon', async () => {
    storage.loadAssets.mockResolvedValue([{ ...item, category: '文娱', subcategory: '随身盒' }])
    storage.loadSettings.mockResolvedValue({ dailyCostMode: 'inclusive', theme: 'system', hasSeededDemoData: true,
      customSubcategories: [{ category: '文娱', name: '随身盒', emoji: '', iconKey: 'books' }],
    })
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '清单' }, { timeout: 2500 }))
    fireEvent.click(screen.getByRole('button', { name: '日用' }))
    fireEvent.click(screen.getByRole('button', { name: /历史物品/ }))
    fireEvent.click(within(screen.getByRole('dialog', { name: '物品详情' })).getByRole('button', { name: '编辑' }))
    const form = screen.getByRole('dialog', { name: '编辑物品' })
    expect(within(form).getByRole('button', { name: '文娱' })).toHaveClass('active')
    expect(within(form).getByRole('button', { name: '随身盒' })).toHaveClass('active')
    fireEvent.click(within(form).getByRole('button', { name: '保存' }))
    await waitFor(() => expect(storage.saveAsset).toHaveBeenCalledWith(expect.objectContaining({ category: '文娱', subcategory: '随身盒' })))
  })
})
