import { describe, expect, it } from 'vitest'
import { computeAsset, formatCny, summarizePortfolio } from './calculations'
import type { Asset, Settings } from '../types'

const settings: Settings = { dailyCostMode: 'inclusive', theme: 'system', hasSeededDemoData: true, customSubcategories: [] }
const asset: Asset = {
  id: '1', name: '电脑', category: '数码', subcategory: '笔记本', valueTrackingEnabled: true,
  purchasePriceCny: 1000, purchaseDate: '2026-01-01', photoDataUrl: '', note: '', createdAt: '', updatedAt: '',
}

describe('daily cost calculations', () => {
  it('counts the purchase day in inclusive mode', () => {
    expect(computeAsset(asset, settings, '2026-01-10').daysHeld).toBe(10)
  })

  it('summarizes portfolio totals and rankings', () => {
    const summary = summarizePortfolio([asset], settings, '2026-01-10')
    expect(summary.totalPurchase).toBe(1000)
    expect(summary.recentYearPurchase).toBe(1000)
    expect(summary.totalDailyCost).toBe(100)
  })

  it('only includes the rolling 365-day window in recent investment', () => {
    const olderAsset = { ...asset, id: 'older', purchaseDate: '2025-01-10', purchasePriceCny: 500 }
    const summary = summarizePortfolio([asset, olderAsset], settings, '2026-01-10')

    expect(summary.totalPurchase).toBe(1500)
    expect(summary.recentYearPurchase).toBe(1000)
  })

  it('formats CNY values with two decimals', () => {
    expect(formatCny(12)).toBe('¥12.00')
  })
})
