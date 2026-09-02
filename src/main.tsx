import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

type StartupBoundaryProps = { children: ReactNode }
type StartupBoundaryState = { error: Error | null }

class StartupBoundary extends Component<StartupBoundaryProps, StartupBoundaryState> {
  state: StartupBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): StartupBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Zhiwu startup failed', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="startup-error" role="alert">
        <p className="startup-error__eyebrow">知物未能启动</p>
        <h1>页面加载出现问题</h1>
        <p>请完全关闭 App 后重新打开。若仍然出现，请将下方信息发给开发者。</p>
        <code>{this.state.error.message || 'Unknown startup error'}</code>
      </main>
    )
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StartupBoundary>
      <App />
    </StartupBoundary>
  </StrictMode>,
)

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('input, textarea, [contenteditable="true"], .user-copyable'))
}

// Android WebView may still open its selection/share toolbar even when CSS
// selection is disabled. Keep that toolbar available only for editable values.
document.addEventListener('contextmenu', (event) => {
  if (!isEditableTarget(event.target)) event.preventDefault()
})

document.addEventListener('selectstart', (event) => {
  if (!isEditableTarget(event.target)) event.preventDefault()
})

async function removeWebAppCaches() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))
  }

  if ('caches' in window) {
    const keys = await window.caches.keys()
    await Promise.all(keys.map((key) => window.caches.delete(key)))
  }
}

if (Capacitor.isNativePlatform()) {
  // A native bundle is already available offline; a PWA service worker only
  // adds another cache layer and can retain obsolete hashed assets on update.
  void removeWebAppCaches().catch((error) => console.warn('Cache cleanup failed', error))
} else if (import.meta.env.PROD) {
  registerSW({ immediate: true })
} else {
  void removeWebAppCaches().catch(() => undefined)
}
