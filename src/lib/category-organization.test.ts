import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { describe, expect, it } from 'vitest'
import {
  canonicalizeItemCategoryPair,
  getActiveItemCategory,
  getCategoryDisplayName,
  getSelectableCategoryGroups,
  getSubcategoryDisplayName,
  getSubcategoryMeta,
  normalizeCategoryPair,
  type Asset,
  type CustomSubcategory,
} from '../types'
import { normalizeAsset } from './asset-normalization'
import { createBackup, parseBackup } from './backup'
import { normalizeCustomSubcategories } from './custom-subcategories'
import { defaultSettings, loadAssets, loadSettings, replaceAllData, updateCustomSubcategory } from './storage'

const item: Asset = {
  id: 'legacy-item', name: '一直在用的物品', kind: 'item', category: '数码', subcategory: '手机',
  valueTrackingEnabled: true, purchasePriceCny: 1234.56, purchaseDate: '2025-03-08',
  photoDataUrl: 'data:image/png;base64,AA==', note: '购买时留下的备注',
  createdAt: '2025-03-08T01:02:03.000Z', updatedAt: '2026-01-09T04:05:06.000Z',
}

const moves = [
  ['数码', '智能手表', '穿戴', 'smart-watch'],
  ['家电', '电视', '数码', 'television'],
  ['家电', '吹风机', '日用', 'hair-dryer'],
  ['家电', '剃须刀', '日用', 'shaver'],
  ['家电', '电动牙刷', '日用', 'toothbrush'],
  ['家电', '体重秤', '日用', 'scale'],
  ['日用', '平底锅', '家电', 'frying-pan'],
  ['日用', '汤锅', '家电', 'cooking-pot'],
  ['日用', '枕头', '家电', 'pillow'],
  ['日用', '闹钟', '家电', 'alarm-clock'],
] as const

describe('scene-based category compatibility', () => {
  it.each(moves)('moves %s/%s to %s without changing the record or losing its icon', (source, name, target, iconKey) => {
    const original = { ...item, category: source, subcategory: name }
    const normalized = normalizeAsset(original)
    expect(normalized).toMatchObject({ ...original, category: target })
    expect(normalizeAsset(normalized)).toEqual(normalized)
    expect(getActiveItemCategory(source, name)).toBe(target)
    expect(getSubcategoryMeta(name, [], source)).toMatchObject({ category: target, iconKey })
  })

  it('keeps service category and payment details unchanged for every relocated item name', () => {
    for (const [category, subcategory] of moves) {
      const service: Asset = {
        ...item, kind: 'service', category, subcategory, serviceCategory: '生活服务',
        billingMode: 'subscription', billingCycle: 'yearly', serviceAmountCny: 168,
        nextEventDate: '2027-03-08', autoRenew: false, reminderDays: 7, planName: '旧年卡',
      }
      expect(normalizeAsset(service)).toMatchObject(service)
    }
  })

  it('uses Home as the visible name while accepting both storage and imported category names', () => {
    expect(getCategoryDisplayName('家电')).toBe('家居')
    expect(getSubcategoryDisplayName('家电', '其他家电')).toBe('其他家居')
    expect(normalizeCategoryPair('家居', '平底锅')).toEqual({ category: '家电', subcategory: '平底锅' })
    expect(normalizeCategoryPair('家居', '其他家居')).toEqual({ category: '家电', subcategory: '其他家电' })
    expect(normalizeCategoryPair('家电', '平底锅')).toEqual({ category: '家电', subcategory: '平底锅' })
  })

  it('retains 89 selectable built-in kinds across five categories without duplicate entries', () => {
    const groups = getSelectableCategoryGroups()
    expect(groups.map((group) => getCategoryDisplayName(group.name))).toEqual(['数码', '家居', '穿戴', '运动', '日用'])
    expect(groups.map((group) => group.items.length)).toEqual([28, 24, 13, 13, 11])
    const names = groups.flatMap((group) => group.items.map((kind) => kind.name))
    expect(names).toHaveLength(89)
    expect(new Set(names).size).toBe(names.length)
    expect(names).not.toContain('首饰')
    expect(names).not.toContain('露营')
  })

  it('does not move same-named custom kinds from unrelated source categories', () => {
    const custom: CustomSubcategory[] = [
      { category: '数码', name: '平底锅', emoji: '✨', iconKey: 'tools' },
      { category: '家电', name: '智能手表', emoji: '✨', iconKey: 'books' },
      { category: '文娱', name: '电视', emoji: '✨', iconKey: 'guitar' },
    ]
    expect(normalizeCustomSubcategories(custom)).toEqual(custom)
    for (const definition of custom) {
      expect(normalizeAsset({ ...item, category: definition.category, subcategory: definition.name }))
        .toMatchObject({ category: definition.category, subcategory: definition.name })
      expect(getSubcategoryMeta(definition.name, custom, definition.category).iconKey).toBeUndefined()
    }
  })

  it('treats inherited JavaScript property names as ordinary user-defined names', () => {
    for (const name of ['constructor', 'toString', '__proto__']) {
      expect(canonicalizeItemCategoryPair('数码', name)).toEqual({ category: '数码', subcategory: name })
      expect(normalizeCategoryPair('数码', name)).toEqual({ category: '数码', subcategory: name })
    }
  })

  it('preserves colliding custom definitions and all record fields through a JSON roundtrip', () => {
    const custom: CustomSubcategory[] = [
      { category: '家电', name: '吹风机', emoji: '✨', iconKey: 'books' },
      { category: '日用', name: '吹风机', emoji: '📦', iconKey: 'tools' },
      { category: '数码', name: '吹风机', emoji: '📷', iconKey: 'camera' },
    ]
    const originals = custom.map((kind, index) => ({ ...item, id: `custom-${index}`, category: kind.category, subcategory: kind.name }))
    const imported = parseBackup(JSON.parse(JSON.stringify(createBackup(originals, { ...defaultSettings, customSubcategories: custom }))))
    expect(imported.settings.customSubcategories).toEqual([
      { ...custom[0], category: '日用' }, custom[1], custom[2],
    ])
    imported.assets.forEach((asset, index) => expect(asset).toMatchObject({
      ...originals[index], category: index === 0 ? '日用' : originals[index].category,
    }))
    expect(getSubcategoryMeta('吹风机', imported.settings.customSubcategories, '日用').iconKey).toBe('hair-dryer')
    expect(getSubcategoryMeta('吹风机', imported.settings.customSubcategories, '数码').iconKey).toBeUndefined()
    expect(parseBackup(JSON.parse(JSON.stringify(createBackup(imported.assets, imported.settings))))).toEqual(imported)
  })

  it('loads old records under the new categories without rewriting stored originals', async () => {
    const originals = moves.map(([category, subcategory], index) => ({ ...item, id: `old-${index}`, category, subcategory }))
    await replaceAllData(originals, defaultSettings)
    const loaded = await loadAssets()
    for (let index = 0; index < moves.length; index += 1) {
      expect(loaded.find((asset) => asset.id === originals[index].id)).toMatchObject({ ...originals[index], category: moves[index][2] })
    }
    const db = await openDB('zhiwu-db', 1)
    for (const original of originals) expect(await db.get('assets', original.id)).toEqual(original)
    db.close()
  })

  it('renames a moved historical custom kind while leaving unrelated items and services intact', async () => {
    const previous: CustomSubcategory = { category: '家电', name: '吹风机', emoji: '✨', iconKey: 'books' }
    const next: CustomSubcategory = { ...previous, category: '日用', name: '旅行吹风机' }
    await replaceAllData([
      { ...item, id: 'moved', category: '家电', subcategory: previous.name },
      { ...item, id: 'unrelated', category: '数码', subcategory: previous.name },
      { ...item, id: 'service', kind: 'service', category: '家电', subcategory: previous.name, serviceCategory: '生活服务' },
    ], { ...defaultSettings, customSubcategories: [previous] })
    await updateCustomSubcategory(previous, next, { ...defaultSettings, customSubcategories: [next] })
    const saved = await loadAssets()
    expect(saved.find((asset) => asset.id === 'moved')).toMatchObject({ ...item, id: 'moved', category: '日用', subcategory: next.name })
    expect(saved.find((asset) => asset.id === 'unrelated')).toMatchObject({ category: '数码', subcategory: previous.name })
    expect(saved.find((asset) => asset.id === 'service')).toMatchObject({ kind: 'service', category: '家电', subcategory: previous.name, serviceCategory: '生活服务' })
    expect((await loadSettings()).customSubcategories).toEqual([next])
  })
})
