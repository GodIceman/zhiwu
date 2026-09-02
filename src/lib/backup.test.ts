import { describe, expect, it } from 'vitest'
import { buildCsv, createBackup, parseBackup } from './backup'
import type { Asset, Settings } from '../types'

const asset: Asset = {
  id: '1', name: '相机', category: '数码', subcategory: '相机', valueTrackingEnabled: true,
  purchasePriceCny: 6000, purchaseDate: '2026-01-01', photoDataUrl: '', note: '旅行', createdAt: '', updatedAt: '',
}
const settings: Settings = { dailyCostMode: 'inclusive', theme: 'system', hasSeededDemoData: true, customSubcategories: [] }

describe('backup helpers', () => {
  it('parses a JSON backup created by export', () => {
    expect(parseBackup(createBackup([asset], settings)).assets[0].name).toBe('相机')
  })

  it('creates a CSV list for spreadsheet review', () => {
    expect(buildCsv([asset])).toContain('相机')
  })

  it('migrates renamed service categories while importing an older backup', () => {
    const imported = parseBackup({
      version: 2,
      assets: [
        {
          ...asset,
          id: 'legacy-service',
          name: '背单词',
          kind: 'service',
          serviceCategory: '阅读学习',
        },
      ],
      settings,
    })

    expect(imported.assets[0].serviceCategory).toBe('学习教育')
  })
})
