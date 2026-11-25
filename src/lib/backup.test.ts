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

  it('exports the current display category for a legacy item without changing service categories', () => {
    const csv = buildCsv([
      { ...asset, category: '日用', subcategory: '平底锅' },
      { ...asset, category: '家电', subcategory: '吹风机' },
      { ...asset, kind: 'service', serviceCategory: '生活服务', planName: '年卡' },
    ])
    expect(csv).toContain('"家居","平底锅"')
    expect(csv).toContain('"日用","吹风机"')
    expect(csv).toContain('"生活服务","年卡"')
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
          serviceAmountCny: 30,
        },
      ],
      settings,
    })

    expect(imported.assets[0].serviceCategory).toBe('学习教育')
  })

  it('accepts version 1 records without the newer optional fields', () => {
    expect(parseBackup({ version: 1, assets: [asset] }).assets[0].name).toBe('相机')
  })

  it('restores an old Other custom item into Daily without changing its name or service categories', () => {
    const imported = parseBackup({
      version: 2,
      assets: [
        { ...asset, category: '其他', subcategory: '纪念品', photoDataUrl: 'data:image/png;base64,AA==', note: '旧备注' },
        { ...asset, id: 'service', kind: 'service', category: '其他', serviceCategory: '其他', serviceAmountCny: 35 },
      ],
      settings: { ...settings, customSubcategories: [{ category: '其他', name: '纪念品', emoji: '✨', iconKey: 'books' }] },
    })
    expect(imported.assets[0]).toMatchObject({ category: '日用', subcategory: '纪念品', purchasePriceCny: 6000, photoDataUrl: 'data:image/png;base64,AA==', note: '旧备注' })
    expect(imported.settings.customSubcategories[0]).toMatchObject({ category: '日用', name: '纪念品', iconKey: 'books' })
    expect(imported.assets[1].serviceCategory).toBe('其他')
    const roundtrip = parseBackup(JSON.parse(JSON.stringify(createBackup(imported.assets, imported.settings))))
    expect(roundtrip).toEqual(imported)
  })

  it.each([
    { assets: [null] },
    { assets: [{ ...asset, name: '' }] },
    { assets: [{ ...asset, purchasePriceCny: -1 }] },
    { assets: [{ ...asset, purchaseDate: '2026-02-30' }] },
    { assets: [asset, asset] },
    { assets: [asset], settings: { customSubcategories: [null] } },
  ])('rejects malformed backups before replacing data: %#', (payload) => {
    expect(() => parseBackup({ version: 2, ...payload })).toThrow('未导入任何数据')
  })
})
