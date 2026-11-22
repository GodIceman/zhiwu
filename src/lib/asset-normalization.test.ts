import { describe, expect, it } from 'vitest'
import type { Asset } from '../types'
import { normalizeAsset } from './asset-normalization'

describe('asset normalization', () => {
  it('accepts simplified monthly and yearly payment modes', () => {
    const monthly = normalizeAsset({
      kind: 'service',
      billingMode: 'monthly',
      billingCycle: 'custom',
    })
    const yearly = normalizeAsset({
      kind: 'service',
      billingMode: 'yearly',
      billingCycle: 'custom',
    })

    expect(monthly.billingMode).toBe('monthly')
    expect(monthly.billingCycle).toBe('monthly')
    expect(monthly.autoRenew).toBe(true)
    expect(yearly.billingMode).toBe('yearly')
    expect(yearly.billingCycle).toBe('yearly')
  })

  it('forces free services to zero and disables renewal', () => {
    const normalized = normalizeAsset({
      kind: 'service',
      billingMode: 'free',
      serviceAmountCny: 999,
      autoRenew: true,
    })

    expect(normalized.serviceAmountCny).toBe(0)
    expect(normalized.autoRenew).toBe(false)
  })

  it('keeps a supported legacy billing mode', () => {
    const normalized = normalizeAsset({
      kind: 'service',
      billingMode: 'subscription',
      billingCycle: 'quarterly',
    } as Partial<Asset>)

    expect(normalized.billingMode).toBe('subscription')
    expect(normalized.billingCycle).toBe('quarterly')
  })

  it.each([
    ['阅读学习', '学习教育'],
    ['生活会员', '生活服务'],
    ['健康运动', '生活服务'],
  ])('migrates the legacy service category %s', (legacyCategory, expectedCategory) => {
    const normalized = normalizeAsset({
      kind: 'service',
      serviceCategory: legacyCategory,
    } as Partial<Asset>)

    expect(normalized.serviceCategory).toBe(expectedCategory)
  })

  it.each([
    ['智能穿戴', '智能手表', '穿戴'],
    ['游戏机', '游戏设备', '数码'],
    ['电脑外设', '键盘', '数码'],
  ])('migrates the legacy digital subcategory %s', (legacySubcategory, expectedSubcategory, expectedCategory) => {
    const normalized = normalizeAsset({
      kind: 'item',
      category: '数码',
      subcategory: legacySubcategory,
    } as Partial<Asset>)

    expect(normalized.category).toBe(expectedCategory)
    expect(normalized.subcategory).toBe(expectedSubcategory)
  })
})
