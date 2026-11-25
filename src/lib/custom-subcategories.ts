import { canonicalizeItemCategoryPair, type CategoryIconKey, type CustomSubcategory } from '../types'
import { itemCategoryIconUrls } from '../icons/category-icon-catalog'

// A legacy icon remains valid even when it is no longer offered in the picker.
const knownIconKeys = new Set<string>(Object.keys(itemCategoryIconUrls))

export function normalizeCustomIconKey(value: unknown): CategoryIconKey {
  return typeof value === 'string' && knownIconKeys.has(value)
    ? value as CategoryIconKey
    : 'temporary'
}

// Keep historical icon and emoji data for backup compatibility. Presentation
// uses the built-in graphic when covered, or a text badge for custom kinds.
export function normalizeCustomSubcategories(items?: CustomSubcategory[]): CustomSubcategory[] {
  if (!Array.isArray(items)) return []

  return items
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      category: canonicalizeItemCategoryPair(item.category, String(item.name || '')).category,
      name: String(item.name || '').trim(),
      emoji: typeof item.emoji === 'string' && item.emoji.trim() ? item.emoji.trim() : '✨',
      iconKey: normalizeCustomIconKey(item.iconKey),
    }))
    .filter((item) => item.name)
}
