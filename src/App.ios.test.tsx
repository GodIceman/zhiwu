import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { Asset, Settings } from './types'

const mocks = vi.hoisted(() => ({
  loadAssets: vi.fn(), loadSettings: vi.fn(),
  saveSettings: vi.fn(async () => undefined),
  nativeSave: vi.fn(),
  setAppearance: vi.fn(async () => undefined),
  keyboardStyle: vi.fn(async () => undefined),
  statusBarStyle: vi.fn(async () => undefined),
  addListener: vi.fn<(eventName: string) => Promise<{ remove: () => void }>>(async () => ({ remove: vi.fn() })),
  exitApp: vi.fn(),
}))

vi.mock('./lib/storage', () => ({
  loadAssets: mocks.loadAssets, loadSettings: mocks.loadSettings, saveSettings: mocks.saveSettings,
  saveAsset: vi.fn(), deleteAsset: vi.fn(), replaceAllData: vi.fn(),
  clearDemoAssets: vi.fn(), initializeFreshData: vi.fn(), updateCustomSubcategory: vi.fn(),
  defaultSettings: { dailyCostMode: 'inclusive', theme: 'system', hasSeededDemoData: true, customSubcategories: [] },
}))
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'ios' } }))
vi.mock('./lib/ios-native', () => ({ IosNative: { saveTextFile: mocks.nativeSave, setAppearance: mocks.setAppearance } }))
vi.mock('@capacitor/app', () => ({ App: { addListener: mocks.addListener, exitApp: mocks.exitApp } }))
vi.mock('@capacitor/keyboard', () => ({
  KeyboardStyle: { Dark: 'DARK', Light: 'LIGHT', Default: 'DEFAULT' }, Keyboard: { setStyle: mocks.keyboardStyle },
}))
vi.mock('@capacitor/splash-screen', () => ({ SplashScreen: { hide: vi.fn(async () => undefined) } }))
vi.mock('@capacitor/status-bar', () => ({ Style: { Dark: 'DARK', Light: 'LIGHT', Default: 'DEFAULT' }, StatusBar: {
  setOverlaysWebView: vi.fn(async () => undefined), setBackgroundColor: vi.fn(async () => undefined),
  setStyle: mocks.statusBarStyle,
} }))

const settings: Settings = { dailyCostMode: 'inclusive', theme: 'system', hasSeededDemoData: true, customSubcategories: [] }
const item: Asset = {
  id: 'ios-item', name: '通勤耳机 🎧', kind: 'item', category: '数码', subcategory: '耳机',
  valueTrackingEnabled: true, purchasePriceCny: 899, purchaseDate: '2026-01-01',
  photoDataUrl: '', note: '中文备注，保留原文', createdAt: '', updatedAt: '',
}

async function openSettings() {
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: '设置' }, { timeout: 2500 }))
}

describe('iOS settings integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1 })
    mocks.loadAssets.mockResolvedValue([item])
    mocks.loadSettings.mockResolvedValue(settings)
    mocks.nativeSave.mockResolvedValue({ status: 'saved' })
  })
  afterEach(() => vi.unstubAllGlobals())

  it.each([
    ['JSON 备份', 'application/json;charset=utf-8', '.json'],
    ['CSV 清单', 'text/csv;charset=utf-8', '.csv'],
  ])('shows completion only after the native %s save finishes', async (label, mimeType, suffix) => {
    let finish: ((value: { status: 'saved' }) => void) | undefined
    mocks.nativeSave.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    await openSettings()
    fireEvent.click(screen.getByRole('button', { name: label }))
    expect(screen.queryByText(`${label}已保存`)).not.toBeInTheDocument()
    expect(mocks.nativeSave).toHaveBeenCalledOnce()
    const exported = mocks.nativeSave.mock.calls[0][0]
    expect(exported.filename).toMatch(new RegExp(`${suffix.replace('.', '\\.')}$`))
    expect(exported.mimeType).toBe(mimeType)
    expect(exported.text).toContain(item.name)
    expect(exported.text).toContain(item.note)
    if (suffix === '.json') expect(JSON.parse(exported.text).assets[0]).toMatchObject(item)

    finish!({ status: 'saved' })
    expect(await screen.findByRole('status')).toHaveTextContent(`${label}已保存`)
  })

  it('reports picker cancellation without claiming the backup was saved', async () => {
    mocks.nativeSave.mockResolvedValue({ status: 'cancelled' })
    await openSettings()
    fireEvent.click(screen.getByRole('button', { name: 'JSON 备份' }))
    expect(await screen.findByRole('status')).toHaveTextContent('已取消导出')
    expect(screen.queryByText('JSON 备份已保存')).not.toBeInTheDocument()
    expect(screen.queryByRole('alertdialog', { name: '导出失败' })).not.toBeInTheDocument()
  })

  it('shows a retryable failure when the native file cannot be saved', async () => {
    mocks.nativeSave.mockRejectedValue(new Error('No space available'))
    await openSettings()
    fireEvent.click(screen.getByRole('button', { name: 'JSON 备份' }))
    const dialog = await screen.findByRole('alertdialog', { name: '导出失败' })
    expect(within(dialog).getByText('文件未能保存，请检查可用存储空间后重试。')).toBeInTheDocument()
    expect(screen.queryByText('JSON 备份已保存')).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: '知道了' }))
  })

  it('keeps the native appearance and keyboard in sync without registering Android back handling', async () => {
    await openSettings()
    fireEvent.click(screen.getByRole('button', { name: '深色' }))
    await waitFor(() => expect(mocks.setAppearance).toHaveBeenLastCalledWith({ dark: true, followSystem: false }))
    expect(mocks.keyboardStyle).toHaveBeenLastCalledWith({ style: 'DARK' })
    expect(mocks.statusBarStyle).toHaveBeenLastCalledWith({ style: 'DARK' })
    expect(document.documentElement.dataset.theme).toBe('dark')

    fireEvent.click(screen.getByRole('button', { name: '浅色' }))
    await waitFor(() => expect(mocks.setAppearance).toHaveBeenLastCalledWith({ dark: false, followSystem: false }))
    expect(mocks.keyboardStyle).toHaveBeenLastCalledWith({ style: 'LIGHT' })
    expect(document.documentElement.dataset.theme).toBe('light')
    fireEvent.click(screen.getByRole('button', { name: '跟随系统' }))
    await waitFor(() => expect(mocks.setAppearance).toHaveBeenLastCalledWith({ dark: false, followSystem: true }))
    expect(document.documentElement.dataset.theme).toBe('system')
    expect(mocks.addListener.mock.calls.some((args) => args[0] === 'backButton')).toBe(false)
    expect(mocks.exitApp).not.toHaveBeenCalled()
  })

  it('releases the native keyboard and status bar before WebKit updates its previous forced appearance', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    mocks.loadSettings.mockResolvedValue({ ...settings, theme: 'dark' })
    await openSettings()
    expect(mocks.keyboardStyle).toHaveBeenLastCalledWith({ style: 'DARK' })
    fireEvent.click(screen.getByRole('button', { name: '跟随系统' }))
    await waitFor(() => expect(mocks.setAppearance).toHaveBeenLastCalledWith({ dark: true, followSystem: true }))
    expect(mocks.keyboardStyle).toHaveBeenLastCalledWith({ style: 'DEFAULT' })
    expect(mocks.statusBarStyle).toHaveBeenLastCalledWith({ style: 'DEFAULT' })
  })
})
