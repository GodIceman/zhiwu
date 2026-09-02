import type { Asset } from '../types'
import type { ComputedAsset } from './calculations'

export type SortKey = 'daily-desc' | 'daily-asc' | 'date-desc' | 'price-desc' | 'price-asc' | 'name-asc'

export function filterAssets(assets: Asset[], search: string, category: string) {
  const keyword = search.trim().toLowerCase()

  return assets.filter((asset) => {
    const matchesKeyword =
      !keyword ||
      asset.name.toLowerCase().includes(keyword) ||
      asset.subcategory.toLowerCase().includes(keyword) ||
      asset.note.toLowerCase().includes(keyword)
    const matchesCategory = category === '全部' || asset.category === category

    return matchesKeyword && matchesCategory
  })
}

export function sortComputedAssets(assets: ComputedAsset[], sortKey: SortKey) {
  return [...assets].sort((a, b) => {
    if (sortKey === 'daily-asc') return valueForSort(a.dailyCost, 'asc') - valueForSort(b.dailyCost, 'asc')
    if (sortKey === 'date-desc') return b.purchaseDate.localeCompare(a.purchaseDate)
    if (sortKey === 'price-desc') return purchaseValueForSort(b, 'desc') - purchaseValueForSort(a, 'desc')
    if (sortKey === 'price-asc') return purchaseValueForSort(a, 'asc') - purchaseValueForSort(b, 'asc')
    if (sortKey === 'name-asc') return a.name.localeCompare(b.name, 'zh-CN')

    return valueForSort(b.dailyCost, 'desc') - valueForSort(a.dailyCost, 'desc')
  })
}

function purchaseValueForSort(asset: ComputedAsset, direction: 'asc' | 'desc') {
  if (asset.valueTrackingEnabled) return asset.purchasePriceCny

  return direction === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY
}

function valueForSort(value: number | null, direction: 'asc' | 'desc') {
  if (value !== null) return value

  return direction === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY
}
