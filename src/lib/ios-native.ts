import { registerPlugin } from '@capacitor/core'

interface ZhiwuNativePlugin {
  pickBackupFile(): Promise<{ status: 'selected'; text: string } | { status: 'cancelled' }>
  saveTextFile(options: { filename: string; text: string; mimeType: string }): Promise<{ status: 'saved' | 'cancelled' }>
  setAppearance(options: { dark: boolean; followSystem: boolean }): Promise<void>
}

export const IosNative = registerPlugin<ZhiwuNativePlugin>('ZhiwuNative')
