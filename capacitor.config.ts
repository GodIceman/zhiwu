import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.zhiwu.mobile',
  appName: '知物',
  webDir: 'dist',
  server: {
    // Use a stable native-only origin. Previous releases shared the default
    // https://localhost origin with a PWA service worker, which could serve a
    // stale index.html after an APK update and leave the WebView blank.
    hostname: 'zhiwu.app',
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#F6F5F1',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
}

export default config
