import type { CSSProperties } from 'react'
import type { CategoryIconKey, ServiceCategory } from '../types'
import {
  itemCategoryIconUrls,
  serviceCategoryDetailIconUrls,
  serviceCategoryIconUrls,
} from './category-icon-catalog'

type CatalogGlyphProps = {
  src: string
  size?: number
  opticalScale?: number
  className?: string
}

export type CategoryGlyphVariant = 'compact' | 'detail'

const categoryGlyphSizes: Record<CategoryGlyphVariant, number> = {
  compact: 28,
  detail: 42,
}

const itemOpticalScales: Partial<Record<CategoryIconKey, number>> = {
  phone: 1.04,
  laptop: 1.07,
  tablet: 1.04,
  headphones: 1.03,
  'smart-watch': 1.04,
  desktop: 1.03,
  monitor: 1.06,
  camera: 1.02,
  'game-device': 1.05,
  speaker: 1.03,
  keyboard: 1.08,
  mouse: 1.04,
  refrigerator: 1.05,
  'air-conditioner': 1.08,
  'washing-machine': 1.02,
  television: 1.07,
  'water-heater': 1.05,
  microwave: 1.06,
  'rice-cooker': 1.03,
  'vacuum-cleaner': 1.08,
  'robot-vacuum': 1.05,
  'air-purifier': 1.05,
}

const serviceOpticalScales: Record<ServiceCategory, number> = {
  AI服务: 1.02,
  音乐: 1.07,
  视频: 1.07,
  游戏: 1.05,
  云存储: 1.06,
  软件工具: 1.02,
  学习教育: 1.06,
  生活服务: 1.05,
  其他: 1,
}

function CatalogGlyph({ src, size, opticalScale = 1, className = '' }: CatalogGlyphProps) {
  const style = {
    '--catalog-glyph-url': `url("${src}")`,
    ...(size ? { '--catalog-glyph-size': `${size}px` } : {}),
    '--catalog-glyph-optical-scale': opticalScale,
  } as CSSProperties

  return <span className={`catalog-glyph ${className}`.trim()} style={style} aria-hidden="true" />
}

export function ItemCategoryGlyph({
  iconKey,
  variant = 'compact',
  className,
}: {
  iconKey: CategoryIconKey
  variant?: CategoryGlyphVariant
  className?: string
}) {
  return (
    <CatalogGlyph
      src={itemCategoryIconUrls[iconKey]}
      size={categoryGlyphSizes[variant]}
      opticalScale={itemOpticalScales[iconKey]}
      className={`item-category-glyph ${className ?? ''}`}
    />
  )
}

export function CustomKindGlyph({
  name,
  variant = 'compact',
}: {
  name: string
  variant?: CategoryGlyphVariant
}) {
  const text = (name.normalize('NFC').match(/[\p{L}\p{N}]/gu) ?? []).slice(0, 2).join('') || '物'
  const style = { '--custom-glyph-size': `${categoryGlyphSizes[variant]}px` } as CSSProperties

  return (
    <span
      className={`custom-kind-glyph${Array.from(text).length === 1 ? ' single-character' : ''}`}
      style={style}
      aria-hidden="true"
    >
      {text}
    </span>
  )
}

export function ServiceCategoryGlyph({
  category,
  variant = 'compact',
}: {
  category: ServiceCategory
  variant?: CategoryGlyphVariant
}) {
  const icons = variant === 'detail' ? serviceCategoryDetailIconUrls : serviceCategoryIconUrls

  return (
    <CatalogGlyph
      src={icons[category]}
      size={categoryGlyphSizes[variant]}
      opticalScale={serviceOpticalScales[category]}
      className="service-category-glyph"
    />
  )
}
