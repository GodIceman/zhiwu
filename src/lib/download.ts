import { Capacitor } from '@capacitor/core'
import { IosNative } from './ios-native'

type ZhiwuExportWindow = Window & {
  ZhiwuFileExport?: {
    saveTextFile: (filename: string, text: string, type: string) => void
  }
}

export async function downloadTextFile(filename: string, text: string, type: string): Promise<'saved' | 'cancelled' | 'started'> {
  if (Capacitor.getPlatform() === 'ios') {
    const result = await IosNative.saveTextFile({ filename, text, mimeType: type })
    return result.status
  }

  const nativeExport = (window as ZhiwuExportWindow).ZhiwuFileExport

  if (nativeExport) {
    nativeExport.saveTextFile(filename, text, type)
    return 'started'
  }

  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  return 'started'
}
