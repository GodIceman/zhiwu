import type { CapacitorConfig } from '@capacitor/cli'
import { KeyboardResize } from '@capacitor/keyboard'

const config: CapacitorConfig = {
  appId: 'app.zhiwu.mobile',
  appName: '知物',
  webDir: 'dist',
  ios: {
    // CSS owns all safe-area padding; don't add a second native inset.
    contentInset: 'never',
    backgroundColor: '#F6F5F1',
    preferredContentMode: 'mobile',
  },
  server: {
    // Use a stable native-only origin. Previous releases shared the default
    // https://localhost origin with a PWA service worker, which could serve a
    // stale index.html after an APK update and leave the WebView blank.
    hostname: 'zhiwu.app',
    androidScheme: 'https',
    iosScheme: 'capacitor',
  },
  plugins: {
    Keyboard: {
      resize: KeyboardResize.Native,
    },
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#F6F5F1',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
}

export default config
