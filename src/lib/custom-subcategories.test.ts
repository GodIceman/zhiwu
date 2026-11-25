import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createDemoAssets } from './demo-data'
import { createBackup, parseBackup } from './backup'
import { defaultSettings, loadAssets, loadSettings, replaceAllData, updateCustomSubcategory } from './storage'
import { getSubcategoryMeta, type CustomSubcategory } from '../types'
import { filterAssets } from './asset-utils'

describe('custom kind persistence', () => {
  it('retains icons through storage and JSON restore, with safe legacy fallback', async () => {
    const custom: CustomSubcategory[] = [
      { category: '数码', name: '长焦镜头', emoji: '📷', iconKey: 'lens' },
      { category: '其他', name: '旧种类', emoji: '✨' },
      { category: '其他', name: '新版本图标', emoji: '', iconKey: 'future' as CustomSubcategory['iconKey'] },
    ]
    await replaceAllData([], { ...defaultSettings, customSubcategories: custom })
    const reloaded = await loadSettings()
    expect(reloaded.customSubcategories.map((x) => x.iconKey)).toEqual(['lens', 'temporary', 'temporary'])
    const imported = parseBackup(JSON.parse(JSON.stringify(createBackup([], reloaded))))
    await replaceAllData(imported.assets, imported.settings)
    expect((await loadSettings()).customSubcategories).toEqual(reloaded.customSubcategories)
    for (const kind of reloaded.customSubcategories) {
      expect(getSubcategoryMeta(kind.name, reloaded.customSubcategories, kind.category).iconKey).toBeUndefined()
    }
  })

  it('renames only matching items, retaining the icon and other categories', async () => {
    const base = createDemoAssets().find((x) => x.kind !== 'service')!
    const previous: CustomSubcategory = { category: '数码', name: '长焦镜头', emoji: '', iconKey: 'lens' }
    const next: CustomSubcategory = { ...previous, name: '摄影镜头', iconKey: 'tripod' }
    const records = [
      { ...base, id: 'a', category: '数码' as const, subcategory: previous.name },
      { ...base, id: 'b', category: '数码' as const, subcategory: previous.name },
      { ...base, id: 'c', category: '其他' as const, subcategory: previous.name },
      { ...base, id: 'd', kind: 'service' as const, category: '数码' as const, subcategory: previous.name },
    ]
    await replaceAllData(records, { ...defaultSettings, customSubcategories: [previous] })
    await updateCustomSubcategory(previous, next, { ...defaultSettings, customSubcategories: [next] })
    const saved = await loadAssets()
    expect(saved.filter((x) => ['a', 'b'].includes(x.id)).map((x) => x.subcategory)).toEqual([next.name, next.name])
    expect(saved.find((x) => x.id === 'c')?.subcategory).toBe(previous.name)
    expect((await loadSettings()).customSubcategories[0].iconKey).toBe('tripod')
  })

  it('uses official artwork for newly covered kinds without rewriting saved records or historical icon data', async () => {
    const base = createDemoAssets().find((x) => x.kind !== 'service')!
    const custom: CustomSubcategory[] = [{ category: '数码', name: '显卡', emoji: '', iconKey: 'tripod' }]
    const record = { ...base, id: 'legacy-gpu', name: '我的显卡', category: '数码' as const, subcategory: '显卡', purchasePriceCny: 2999, note: '旧备注' }
    await replaceAllData([record], { ...defaultSettings, customSubcategories: custom })
    const settings = await loadSettings()
    const assets = await loadAssets()
    expect(assets[0]).toMatchObject(record)
    expect(settings.customSubcategories[0].iconKey).toBe('tripod')
    expect(getSubcategoryMeta('显卡', settings.customSubcategories, '数码').iconKey).toBe('graphics-card')
    const restored = parseBackup(JSON.parse(JSON.stringify(createBackup(assets, settings))))
    expect(restored.assets[0]).toMatchObject(record)
    expect(restored.settings.customSubcategories[0].iconKey).toBe('tripod')
    expect(getSubcategoryMeta('镜头', [{ category: '数码', name: '镜头', emoji: '', iconKey: 'tripod' }], '数码').iconKey).toBe('lens')
  })

  it('moves old Other items and custom kinds together and renames records still stored under Other', async () => {
    const base = createDemoAssets().find((x) => x.kind !== 'service')!
    const previous: CustomSubcategory = { category: '其他', name: '旧工具箱', emoji: '🧰', iconKey: 'tools' }
    await replaceAllData([
      { ...base, id: 'old-other', category: '其他', subcategory: previous.name, note: '保留备注', purchasePriceCny: 235 },
      { ...base, id: 'service', kind: 'service', category: '其他', subcategory: previous.name, serviceCategory: '其他' },
    ], { ...defaultSettings, customSubcategories: [previous] })
    const settings = await loadSettings()
    const records = await loadAssets()
    expect(records.find((x) => x.id === 'old-other')).toMatchObject({ category: '日用', subcategory: previous.name, note: '保留备注', purchasePriceCny: 235 })
    expect(settings.customSubcategories[0]).toMatchObject({ category: '日用', name: previous.name, iconKey: 'tools' })
    expect(filterAssets(records.filter((x) => x.kind !== 'service'), '', '日用')).toHaveLength(1)

    const next = { ...settings.customSubcategories[0], name: '修理工具箱' }
    await updateCustomSubcategory(settings.customSubcategories[0], next, { ...settings, customSubcategories: [next] })
    const saved = await loadAssets()
    expect(saved.find((x) => x.id === 'old-other')).toMatchObject({ category: '日用', subcategory: next.name, note: '保留备注', purchasePriceCny: 235 })
    expect(saved.find((x) => x.id === 'service')).toMatchObject({ subcategory: previous.name, serviceCategory: '其他' })
  })

  it('keeps names, icons and category identity through restoring legacy categories with duplicate custom names', async () => {
    const base = createDemoAssets().find((x) => x.kind !== 'service')!
    const custom: CustomSubcategory[] = [
      { category: '个护', name: '随身盒', emoji: '', iconKey: 'tools' },
      { category: '文娱', name: '随身盒', emoji: '', iconKey: 'guitar' },
      { category: '数码', name: '存储设备', emoji: '', iconKey: 'tripod' },
    ]
    const raw = createBackup(custom.map((kind, index) => ({ ...base, id: `legacy-${index}`, category: kind.category, subcategory: kind.name })), { ...defaultSettings, customSubcategories: custom })
    const imported = parseBackup(JSON.parse(JSON.stringify(raw)))
    await replaceAllData(imported.assets, imported.settings)
    const saved = await loadAssets()
    const settings = await loadSettings()
    expect(saved.map((asset) => [asset.category, asset.subcategory])).toEqual(custom.map((kind) => [kind.category, kind.name]))
    expect(filterAssets(saved, '', '日用').map((asset) => asset.id)).toEqual(['legacy-0', 'legacy-1'])
    for (const kind of custom) {
      expect(settings.customSubcategories.find((item) => item.category === kind.category && item.name === kind.name)?.iconKey).toBe(kind.iconKey)
      expect(getSubcategoryMeta(kind.name, settings.customSubcategories, kind.category)).toMatchObject({
        name: kind.name,
        iconKey: kind.name === '存储设备' ? 'drive' : undefined,
      })
    }
    expect(getSubcategoryMeta('存储设备', [], '数码').name).toBe('移动硬盘')
  })
})
