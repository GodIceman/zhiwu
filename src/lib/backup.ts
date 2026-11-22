import { getCategoryDisplayName, normalizeCategoryPair, type Asset, type BackupPayload, type Settings } from '../types'
import { normalizeAsset } from './asset-normalization'
import { normalizeCustomSubcategories } from './custom-subcategories'
import { defaultSettings } from './settings-defaults'

export function createBackup(assets: Asset[], settings: Settings): BackupPayload {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    assets,
    settings,
  }
}

export function parseBackup(raw: unknown) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('导入文件格式不正确')
  }

  const payload = raw as { version?: number; assets?: unknown[]; settings?: unknown }

  if (![1, 2].includes(payload.version ?? 0) || !Array.isArray(payload.assets)) {
    throw new Error('导入文件版本不支持')
  }

  const ids = new Set<string>()
  payload.assets.forEach((value, index) => {
    const label = `第 ${index + 1} 条记录`
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`${label}格式不正确，未导入任何数据`)
    }
    const asset = value as Record<string, unknown>
    if (typeof asset.id !== 'string' || !asset.id.trim() || ids.has(asset.id)) {
      throw new Error(`${label}的标识缺失或重复，未导入任何数据`)
    }
    ids.add(asset.id)
    if (typeof asset.name !== 'string' || !asset.name.trim()) {
      throw new Error(`${label}的名称缺失，未导入任何数据`)
    }
    if (asset.kind !== undefined && asset.kind !== 'item' && asset.kind !== 'service') {
      throw new Error(`${label}的类型不受支持，未导入任何数据`)
    }
    for (const field of ['valueTrackingEnabled', 'autoRenew'] as const) {
      if (asset[field] !== undefined && typeof asset[field] !== 'boolean') {
        throw new Error(`${label}的设置无效，未导入任何数据`)
      }
    }
    const amountField = asset.kind === 'service' ? 'serviceAmountCny' : 'purchasePriceCny'
    if (asset[amountField] === undefined) {
      throw new Error(`${label}的金额缺失，未导入任何数据`)
    }
    for (const field of ['purchasePriceCny', 'serviceAmountCny'] as const) {
      const amount = asset[field]
      if (amount !== undefined && (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0)) {
        throw new Error(`${label}的金额无效，未导入任何数据`)
      }
    }
    for (const field of ['purchaseDate', 'nextEventDate'] as const) {
      const date = asset[field]
      if (date !== undefined && date !== '' && !isValidDate(date)) {
        throw new Error(`${label}的日期无效，未导入任何数据`)
      }
    }
  })

  if (payload.settings !== undefined && payload.settings !== null) {
    if (typeof payload.settings !== 'object' || Array.isArray(payload.settings)) {
      throw new Error('备份中的设置格式不正确，未导入任何数据')
    }
    const settings = payload.settings as Record<string, unknown>
    if (settings.customSubcategories !== undefined && (
      !Array.isArray(settings.customSubcategories) || settings.customSubcategories.some((item: unknown) =>
        !item || typeof item !== 'object' || Array.isArray(item)
        || typeof (item as Record<string, unknown>).category !== 'string'
        || typeof (item as Record<string, unknown>).name !== 'string'
        || ((item as Record<string, unknown>).emoji !== undefined
          && typeof (item as Record<string, unknown>).emoji !== 'string'),
      )
    )) {
      throw new Error('备份中的自定义分类格式不正确，未导入任何数据')
    }
  }

  return {
    assets: payload.assets.map((asset) => normalizeAsset(asset as Partial<Asset>)),
    settings: normalizeImportedSettings(payload.settings),
  }
}

function isValidDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function normalizeImportedSettings(settings: unknown): Settings {
  if (!settings || typeof settings !== 'object') {
    return { ...defaultSettings, hasSeededDemoData: true }
  }

  const raw = settings as Partial<Settings>

  return {
    dailyCostMode: raw.dailyCostMode === 'elapsed' ? 'elapsed' : 'inclusive',
    theme: raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : 'system',
    hasSeededDemoData: true,
    customSubcategories: normalizeCustomSubcategories(raw.customSubcategories),
  }
}

export function buildCsv(assets: Asset[]) {
  const header = [
    '类型',
    '名称',
    '一级分类',
    '二级分类',
    '计算日均',
    '物品价值/服务金额',
    '开始日期',
    '计费方式',
    '付费周期',
    '下次关键日期',
    '自动续费',
    '备注',
  ]
  const rows = assets.map((asset) => [
    asset.kind === 'service' ? '服务' : '物品',
    asset.name,
    asset.kind === 'service' ? asset.serviceCategory
      : getCategoryDisplayName(normalizeCategoryPair(asset.category, asset.subcategory).category),
    asset.kind === 'service' ? asset.planName : asset.subcategory,
    asset.kind === 'service' ? '' : asset.valueTrackingEnabled ? '是' : '否',
    String(asset.kind === 'service' ? asset.serviceAmountCny ?? 0 : asset.purchasePriceCny),
    asset.purchaseDate,
    asset.kind === 'service' ? asset.billingMode : '',
    asset.kind === 'service' ? asset.billingCycle : '',
    asset.kind === 'service' ? asset.nextEventDate : '',
    asset.kind === 'service' ? asset.autoRenew === false ? '否' : '是' : '',
    asset.note,
  ])

  return `\uFEFF${[header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n')}`
}

function escapeCsv(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}
