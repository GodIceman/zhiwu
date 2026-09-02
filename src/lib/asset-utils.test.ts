import { describe, expect, it } from 'vitest'
import { filterAssets, sortComputedAssets } from './asset-utils'
import type { ComputedAsset } from './calculations'

const asset: ComputedAsset = {
  id: '1', name: '手机', category: '数码', subcategory: '手机', valueTrackingEnabled: true,
  purchasePriceCny: 1000, purchaseDate: '2026-01-01', photoDataUrl: '', note: '',
  createdAt: '', updatedAt: '', daysHeld: 10, dailyCost: 100,
}

describe('asset list helpers', () => {
  it('filters by keyword and category', () => {
    expect(filterAssets([asset], '手机', '数码')).toHaveLength(1)
    expect(filterAssets([asset], '咖啡', '全部')).toHaveLength(0)
  })

  it('sorts computed assets by daily cost', () => {
    const cheaper = { ...asset, id: '2', dailyCost: 20 }
    expect(sortComputedAssets([cheaper, asset], 'daily-desc')[0].id).toBe('1')
  })
})
