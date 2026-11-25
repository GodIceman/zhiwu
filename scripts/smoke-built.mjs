import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import 'fake-indexeddb/auto'

const root = resolve(import.meta.dirname, '..')
const html = await readFile(resolve(root, 'dist/index.html'), 'utf8')
const entryMatch = html.match(/<script[^>]+src="([^"]+\.js)"/)

if (!entryMatch) throw new Error('Built JavaScript entry was not found in dist/index.html')

const entryUrl = new URL(entryMatch[1], 'https://zhiwu.app/')
const assetsSegment = entryUrl.pathname.lastIndexOf('/assets/')
if (assetsSegment < 0) throw new Error(`Built JavaScript entry has an unexpected path: ${entryMatch[1]}`)
const entryRelativePath = entryUrl.pathname.slice(assetsSegment + 1)

const dom = new JSDOM('<!doctype html><html><head><meta name="theme-color"></head><body><div id="root"></div></body></html>', {
  url: 'https://zhiwu.app/',
  pretendToBeVisual: true,
})

const { window } = dom
globalThis.window = window
globalThis.document = window.document
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true })

for (const key of Object.getOwnPropertyNames(window)) {
  if (!(key in globalThis)) {
    Object.defineProperty(globalThis, key, Object.getOwnPropertyDescriptor(window, key))
  }
}

for (const key of Object.getOwnPropertyNames(globalThis)) {
  if (key === 'indexedDB' || key.startsWith('IDB')) {
    Object.defineProperty(window, key, { value: globalThis[key], configurable: true })
  }
}

window.matchMedia = () => ({
  matches: false,
  media: '(prefers-color-scheme: dark)',
  onchange: null,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent() { return false },
})
window.alert = () => undefined
window.confirm = () => true

const entryPath = resolve(root, 'dist', entryRelativePath)
await import(`${pathToFileURL(entryPath).href}?smoke=${Date.now()}`)
await new Promise((resolveDelay) => setTimeout(resolveDelay, 1200))

const startupError = document.querySelector('.startup-error code')?.textContent
if (startupError) throw new Error(`Production startup boundary rendered: ${startupError}`)
if (!document.querySelector('.bottom-nav')) throw new Error('Production bundle did not reach primary navigation')

console.log('Production bundle reached primary navigation')
// The app schedules a refresh at local midnight; release jsdom timers on exit.
window.close()
