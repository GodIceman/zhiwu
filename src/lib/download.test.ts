import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadTextFile } from './download'

const native = vi.hoisted(() => ({
  platform: vi.fn(() => 'ios'),
  saveTextFile: vi.fn(),
}))
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: native.platform } }))
vi.mock('./ios-native', () => ({ IosNative: { saveTextFile: native.saveTextFile } }))

type ExportWindow = Window & {
  ZhiwuFileExport?: { saveTextFile: (filename: string, text: string, type: string) => void }
}

const createObjectURL = vi.fn<(object: Blob | MediaSource) => string>(() => 'blob:zhiwu-test')
const revokeObjectURL = vi.fn()

describe('platform file export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    native.platform.mockReturnValue('ios')
    native.saveTextFile.mockResolvedValue({ status: 'saved' })
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    delete (window as ExportWindow).ZhiwuFileExport
  })

  afterEach(() => {
    delete (window as ExportWindow).ZhiwuFileExport
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it.each([
    ['知物备份.json', '{"名称":"通勤耳机 🎧","备注":"第一行\\n第二行"}', 'application/json;charset=utf-8'],
    ['知物清单.csv', '\uFEFF"名称","备注"\n"平底锅","家居，厨房"', 'text/csv;charset=utf-8'],
  ])('exports %s through the iOS picker without altering Unicode content', async (filename, text, mimeType) => {
    const androidExport = vi.fn()
    ;(window as ExportWindow).ZhiwuFileExport = { saveTextFile: androidExport }

    await expect(downloadTextFile(filename, text, mimeType)).resolves.toBe('saved')

    expect(native.saveTextFile).toHaveBeenCalledExactlyOnceWith({ filename, text, mimeType })
    expect(androidExport).not.toHaveBeenCalled()
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it('returns cancellation without attempting a web download', async () => {
    native.saveTextFile.mockResolvedValue({ status: 'cancelled' })

    await expect(downloadTextFile('备份.json', '{}', 'application/json')).resolves.toBe('cancelled')
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it('propagates an iOS save failure instead of pretending a blob download succeeded', async () => {
    const failure = new Error('Cannot write temporary file')
    native.saveTextFile.mockRejectedValue(failure)

    await expect(downloadTextFile('备份.json', '{}', 'application/json')).rejects.toBe(failure)
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it('keeps the existing Android file picker bridge', async () => {
    native.platform.mockReturnValue('android')
    const saveTextFile = vi.fn()
    ;(window as ExportWindow).ZhiwuFileExport = { saveTextFile }

    await expect(downloadTextFile('清单.csv', '中文数据', 'text/csv;charset=utf-8')).resolves.toBe('started')
    expect(saveTextFile).toHaveBeenCalledExactlyOnceWith('清单.csv', '中文数据', 'text/csv;charset=utf-8')
    expect(native.saveTextFile).not.toHaveBeenCalled()
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it('keeps browser downloads and releases the temporary object URL', async () => {
    native.platform.mockReturnValue('web')
    const clicks: { filename: string; href: string; connected: boolean }[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push({ filename: this.download, href: this.href, connected: this.isConnected })
    })
    const text = '中文清单，第一行\n第二行'

    await expect(downloadTextFile('清单.csv', text, 'text/csv;charset=utf-8')).resolves.toBe('started')

    expect(clicks).toEqual([{ filename: '清单.csv', href: 'blob:zhiwu-test', connected: true }])
    expect(native.saveTextFile).not.toHaveBeenCalled()
    expect(createObjectURL).toHaveBeenCalledOnce()
    const blob = createObjectURL.mock.calls[0][0] as Blob
    expect(blob.type).toBe('text/csv;charset=utf-8')
    const reader = new FileReader()
    const read = new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
    })
    reader.readAsText(blob)
    await expect(read).resolves.toBe(text)
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:zhiwu-test')
    expect(document.querySelector('a[download="清单.csv"]')).toBeNull()
  })
})
