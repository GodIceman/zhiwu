import {
  normalizeCategoryPair,
  serviceCategories,
  type AiUsageTag,
  type Asset,
  type BillingCycle,
  type BillingMode,
  type ServiceCategory,
} from '../types'

const billingModes: BillingMode[] = [
  'monthly',
  'yearly',
  'one-time',
  'free',
  'subscription',
  'fixed',
  'credit',
  'usage',
]
const billingCycles: BillingCycle[] = ['weekly', 'monthly', 'quarterly', 'yearly', 'custom']
const aiUsageTags: AiUsageTag[] = ['对话', '编程', '图像视频', '搜索研究', 'API']
const legacyServiceCategories: Record<string, ServiceCategory> = {
  音乐音频: '音乐',
  视频影音: '视频',
  游戏娱乐: '游戏',
  效率工具: '软件工具',
  阅读学习: '学习教育',
  生活会员: '生活服务',
  健康运动: '生活服务',
}

function normalizeServiceCategory(category: unknown): ServiceCategory {
  const value = String(category || '')
  if (serviceCategories.includes(value as ServiceCategory)) return value as ServiceCategory
  return legacyServiceCategories[value] ?? '其他'
}

export function normalizeAsset(asset: Partial<Asset>): Asset {
  const categoryPair = normalizeCategoryPair(
    String(asset.category || '其他'),
    String(asset.subcategory || ''),
  )
  const billingMode = billingModes.includes(asset.billingMode as BillingMode)
    ? asset.billingMode as BillingMode
    : 'subscription'
  const serviceAmountCny = Number.isFinite(Number(asset.serviceAmountCny))
    ? Math.max(0, Number(asset.serviceAmountCny))
    : 0
  const billingCycle = billingMode === 'monthly'
    ? 'monthly'
    : billingMode === 'yearly'
      ? 'yearly'
      : billingCycles.includes(asset.billingCycle as BillingCycle)
        ? asset.billingCycle as BillingCycle
        : 'monthly'
  const supportsAutoRenew = billingMode === 'monthly'
    || billingMode === 'yearly'
    || billingMode === 'subscription'

  return {
    id: String(asset.id || crypto.randomUUID()),
    name: String(asset.name || '').trim(),
    kind: asset.kind === 'service' ? 'service' : 'item',
    category: categoryPair.category,
    subcategory: categoryPair.subcategory,
    valueTrackingEnabled: asset.valueTrackingEnabled !== false,
    purchasePriceCny: Number.isFinite(Number(asset.purchasePriceCny))
      ? Math.max(0, Number(asset.purchasePriceCny))
      : 0,
    purchaseDate: String(asset.purchaseDate || ''),
    photoDataUrl: String(asset.photoDataUrl || ''),
    note: String(asset.note || ''),
    serviceCategory: normalizeServiceCategory(asset.serviceCategory),
    billingMode,
    serviceAmountCny: billingMode === 'free' ? 0 : serviceAmountCny,
    billingCycle,
    nextEventDate: String(asset.nextEventDate || ''),
    autoRenew: supportsAutoRenew ? asset.autoRenew !== false : false,
    reminderDays: Number.isFinite(Number(asset.reminderDays))
      ? Math.max(0, Math.round(Number(asset.reminderDays)))
      : 3,
    planName: String(asset.planName || ''),
    usageTags: Array.isArray(asset.usageTags)
      ? asset.usageTags.filter((tag): tag is AiUsageTag => aiUsageTags.includes(tag as AiUsageTag))
      : [],
    createdAt: String(asset.createdAt || new Date().toISOString()),
    updatedAt: String(asset.updatedAt || new Date().toISOString()),
  }
}
