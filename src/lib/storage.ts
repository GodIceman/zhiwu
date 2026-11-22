import { openDB, type DBSchema } from 'idb'
import { canonicalizeItemCategoryPair, type Asset, type Category, type CustomSubcategory, type Settings } from '../types'
import { normalizeAsset } from './asset-normalization'
import { normalizeCustomSubcategories } from './custom-subcategories'
import { defaultSettings } from './settings-defaults'

const dbName = 'zhiwu-db'
const settingsKey = 'main'

export { defaultSettings }

interface ZhiwuDB extends DBSchema {
  assets: {
    key: string
    value: Asset
    indexes: {
      'by-updated-at': string
    }
  }
  settings: {
    key: string
    value: Settings
  }
}

const dbPromise = openDB<ZhiwuDB>(dbName, 1, {
  upgrade(db) {
    const assetStore = db.createObjectStore('assets', { keyPath: 'id' })
    assetStore.createIndex('by-updated-at', 'updatedAt')
    db.createObjectStore('settings')
  },
})

export async function loadAssets() {
  const db = await dbPromise
  const assets = await db.getAll('assets')

  return assets.map(normalizeAsset)
}

export async function saveAsset(asset: Asset) {
  const db = await dbPromise
  await db.put('assets', asset)
}

export async function saveAssets(assets: Asset[]) {
  const db = await dbPromise
  const tx = db.transaction('assets', 'readwrite')
  await Promise.all(assets.map((asset) => tx.store.put(asset)))
  await tx.done
}

export async function deleteAsset(id: string) {
  const db = await dbPromise
  await db.delete('assets', id)
}

export async function replaceAssets(assets: Asset[]) {
  const db = await dbPromise
  const tx = db.transaction('assets', 'readwrite')
  await tx.store.clear()
  await Promise.all(assets.map((asset) => tx.store.put(asset)))
  await tx.done
}

export async function clearDemoAssets() {
  const db = await dbPromise
  const tx = db.transaction('assets', 'readwrite')
  const existing = await tx.store.getAll()
  await Promise.all(existing.filter((asset) => asset.id.startsWith('demo-')).map((asset) => tx.store.delete(asset.id)))
  await tx.done
  return existing.filter((asset) => !asset.id.startsWith('demo-')).map(normalizeAsset)
}

export async function loadSettings() {
  const db = await dbPromise
  return normalizeSettings(await db.get('settings', settingsKey))
}

export async function saveSettings(settings: Settings) {
  const db = await dbPromise
  await db.put('settings', settings, settingsKey)
}

export async function updateCustomSubcategory(
  previous: { category: Category; name: string },
  next: CustomSubcategory,
  nextSettings: Settings,
) {
  const normalizedNext = normalizeCustomSubcategories([next])[0]
  const previousPair = canonicalizeItemCategoryPair(previous.category, previous.name)
  if (!normalizedNext || normalizedNext.category !== previousPair.category) {
    throw new Error('自定义种类无效，未保存任何修改')
  }

  const db = await dbPromise
  const tx = db.transaction(['assets', 'settings'], 'readwrite')
  try {
    const assetStore = tx.objectStore('assets')
    const assets = await assetStore.getAll()
    await Promise.all(assets.map(normalizeAsset)
      .filter((asset) => asset.kind !== 'service'
        && asset.category === previousPair.category && asset.subcategory === previousPair.subcategory)
      .map((asset) => assetStore.put({ ...asset, subcategory: normalizedNext.name })))
    await tx.objectStore('settings').put(normalizeSettings(nextSettings), settingsKey)
    await tx.done
  } catch (error) {
    // A synchronous cloning error also needs an explicit abort, otherwise the
    // category rename could commit while its settings failed to save.
    try { tx.abort() } catch { /* The transaction may already have aborted. */ }
    await tx.done.catch(() => undefined)
    throw error
  }
}

export async function replaceAllData(assets: Asset[], settings: Settings) {
  const db = await dbPromise
  const tx = db.transaction(['assets', 'settings'], 'readwrite')
  await tx.objectStore('assets').clear()
  await Promise.all(assets.map((asset) => tx.objectStore('assets').put(asset)))
  await tx.objectStore('settings').put(settings, settingsKey)
  await tx.done
}

// The first-run screen can remain open in another tab while data is added.
// Recheck inside the same transaction so initialization never replaces it.
export async function initializeFreshData(demoAssets: Asset[]) {
  const db = await dbPromise
  const tx = db.transaction(['assets', 'settings'], 'readwrite')
  const assetStore = tx.objectStore('assets')
  const settingsStore = tx.objectStore('settings')
  const [existingAssets, storedSettings] = await Promise.all([
    assetStore.getAll(),
    settingsStore.get(settingsKey),
  ])
  const currentSettings = normalizeSettings(storedSettings)
  if (existingAssets.length || currentSettings.hasSeededDemoData) {
    await tx.done
    return { assets: existingAssets.map(normalizeAsset), settings: currentSettings, initialized: false }
  }

  const nextSettings = { ...currentSettings, hasSeededDemoData: true }
  await Promise.all(demoAssets.map((asset) => assetStore.put(asset)))
  await settingsStore.put(nextSettings, settingsKey)
  await tx.done
  return { assets: demoAssets, settings: nextSettings, initialized: true }
}

function normalizeSettings(settings?: Partial<Settings>): Settings {
  return {
    ...defaultSettings,
    ...settings,
    customSubcategories: normalizeCustomSubcategories(settings?.customSubcategories),
  }
}
