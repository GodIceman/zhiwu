import type { Asset, DailyCostMode, Settings } from '../types'
import { addLocalDays, diffLocalDays, toLocalDateKey } from './date'

export interface ComputedAsset extends Asset {
  daysHeld: number | null
  dailyCost: number | null
}

export interface PortfolioSummary {
  totalPurchase: number
  recentYearPurchase: number
  totalDailyCost: number
  averageDailyCost: number
  assetCount: number
  valueTrackedCount: number
  bestValue: ComputedAsset | null
  leastValue: ComputedAsset | null
}

export function getHeldDays(
  purchaseDate: string,
  mode: DailyCostMode,
  todayKey = toLocalDateKey(),
) {
  const elapsedDays = diffLocalDays(purchaseDate, todayKey)
  const rawDays = mode === 'inclusive' ? elapsedDays + 1 : elapsedDays

  return Math.max(1, rawDays)
}

export function calculateDailyCost(
  purchasePriceCny: number,
  purchaseDate: string,
  mode: DailyCostMode,
  todayKey = toLocalDateKey(),
) {
  return purchasePriceCny / getHeldDays(purchaseDate, mode, todayKey)
}

export function computeAsset(
  asset: Asset,
  settings: Pick<Settings, 'dailyCostMode'>,
  todayKey = toLocalDateKey(),
): ComputedAsset {
  const daysHeld = asset.purchaseDate
    ? getHeldDays(asset.purchaseDate, settings.dailyCostMode, todayKey)
    : null

  if (!asset.valueTrackingEnabled) {
    return {
      ...asset,
      daysHeld,
      dailyCost: null,
    }
  }

  return {
    ...asset,
    daysHeld,
    dailyCost: daysHeld === null ? null : asset.purchasePriceCny / daysHeld,
  }
}

export function summarizePortfolio(
  assets: Asset[],
  settings: Pick<Settings, 'dailyCostMode'>,
  todayKey = toLocalDateKey(),
): PortfolioSummary {
  const computed = assets.map((asset) => computeAsset(asset, settings, todayKey))
  const valueTracked = computed.filter(
    (asset) => asset.valueTrackingEnabled && asset.dailyCost !== null,
  )
  const totalPurchase = computed.reduce(
    (total, asset) => total + (asset.valueTrackingEnabled ? asset.purchasePriceCny : 0),
    0,
  )
  const recentYearStart = addLocalDays(todayKey, -364)
  const recentYearPurchase = computed.reduce((total, asset) => {
    if (!asset.valueTrackingEnabled) return total
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asset.purchaseDate)) return total
    if (asset.purchaseDate < recentYearStart || asset.purchaseDate > todayKey) return total
    return total + asset.purchasePriceCny
  }, 0)
  const totalDailyCost = valueTracked.reduce((total, asset) => total + (asset.dailyCost ?? 0), 0)
  const averageDailyCost = valueTracked.length ? totalDailyCost / valueTracked.length : 0
  const byDailyCost = [...valueTracked].sort((a, b) => (a.dailyCost ?? 0) - (b.dailyCost ?? 0))

  return {
    totalPurchase,
    recentYearPurchase,
    totalDailyCost,
    averageDailyCost,
    assetCount: computed.length,
    valueTrackedCount: valueTracked.length,
    bestValue: byDailyCost[0] ?? null,
    leastValue: byDailyCost.at(-1) ?? null,
  }
}

export function formatCny(value: number) {
  return `¥${value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatDailyCny(value: number) {
  return `${formatCny(value)}/天`
}

export function formatAssetDailyCost(asset: Pick<ComputedAsset, 'dailyCost'>) {
  return asset.dailyCost === null ? '仅记录' : formatDailyCny(asset.dailyCost)
}
