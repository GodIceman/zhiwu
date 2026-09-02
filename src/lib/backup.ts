import type { Asset, BackupPayload, Settings } from '../types'
import { normalizeAsset } from './asset-normalization'
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

  return {
    assets: payload.assets.map((asset) => normalizeAsset(asset as Partial<Asset>)),
    settings: normalizeImportedSettings(payload.settings),
  }
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
    customSubcategories: Array.isArray(raw.customSubcategories) ? raw.customSubcategories : [],
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
    asset.kind === 'service' ? asset.serviceCategory : asset.category,
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
