import { openDB, type DBSchema } from 'idb'
import type { Asset, CustomSubcategory, Settings } from '../types'
import { normalizeAsset } from './asset-normalization'
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

export async function loadSettings() {
  const db = await dbPromise
  return normalizeSettings(await db.get('settings', settingsKey))
}

export async function saveSettings(settings: Settings) {
  const db = await dbPromise
  await db.put('settings', settings, settingsKey)
}

export async function replaceAllData(assets: Asset[], settings: Settings) {
  const db = await dbPromise
  const tx = db.transaction(['assets', 'settings'], 'readwrite')
  await tx.objectStore('assets').clear()
  await Promise.all(assets.map((asset) => tx.objectStore('assets').put(asset)))
  await tx.objectStore('settings').put(settings, settingsKey)
  await tx.done
}

function normalizeSettings(settings?: Partial<Settings>): Settings {
  return {
    ...defaultSettings,
    ...settings,
    customSubcategories: normalizeCustomSubcategories(settings?.customSubcategories),
  }
}

function normalizeCustomSubcategories(items?: CustomSubcategory[]) {
  if (!Array.isArray(items)) return []

  return items
    .map((item) => ({
      category: item.category,
      name: String(item.name || '').trim(),
      emoji: String(item.emoji || '✨').trim() || '✨',
    }))
    .filter((item) => item.name)
}
