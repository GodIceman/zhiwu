import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { categoryGroups, normalizeCategoryPair } from '../types'
import {
  itemCategoryIconUrls,
  serviceCategoryDetailIconUrls,
  serviceCategoryIconUrls,
} from './category-icon-catalog'
import { ItemCategoryGlyph, ServiceCategoryGlyph } from './category-icons'
import aiDetailSource from './service-ai-detail.svg?raw'
import aiCompactSource from './service-ai.svg?raw'
import learningDetailSource from './service-learning-detail.svg?raw'
import learningCompactSource from './service-learning.svg?raw'
import phoneSource from './item-phone.svg?raw'
import laptopSource from './item-laptop.svg?raw'
import tabletSource from './item-tablet.svg?raw'
import headphonesSource from './item-headphones.svg?raw'
import smartWatchSource from './item-smart-watch.svg?raw'
import desktopSource from './item-desktop.svg?raw'
import monitorSource from './item-monitor.svg?raw'
import cameraSource from './item-camera.svg?raw'
import gameConsoleSource from './item-game-console.svg?raw'
import speakerSource from './item-speaker.svg?raw'
import keyboardSource from './item-keyboard.svg?raw'
import mouseSource from './item-mouse.svg?raw'
import refrigeratorSource from './item-refrigerator.svg?raw'
import airConditionerSource from './item-air-conditioner.svg?raw'
import washingMachineSource from './item-washing-machine.svg?raw'
import televisionSource from './item-television.svg?raw'
import waterHeaterSource from './item-water-heater.svg?raw'
import microwaveSource from './item-microwave.svg?raw'
import riceCookerSource from './item-rice-cooker.svg?raw'
import ovenSource from './item-oven.svg?raw'
import vacuumCleanerSource from './item-vacuum-cleaner.svg?raw'
import robotVacuumSource from './item-robot-vacuum.svg?raw'
import airPurifierSource from './item-air-purifier.svg?raw'
import electricFanSource from './item-electric-fan.svg?raw'
import cloudDetailSource from './service-cloud-detail.svg?raw'
import cloudCompactSource from './service-cloud.svg?raw'

const digitalItemSources = [
  phoneSource,
  laptopSource,
  tabletSource,
  headphonesSource,
  smartWatchSource,
  desktopSource,
  monitorSource,
  cameraSource,
  gameConsoleSource,
  speakerSource,
  keyboardSource,
  mouseSource,
]

const applianceItemSources = [
  refrigeratorSource,
  airConditionerSource,
  washingMachineSource,
  televisionSource,
  waterHeaterSource,
  microwaveSource,
  riceCookerSource,
  ovenSource,
  vacuumCleanerSource,
  robotVacuumSource,
  airPurifierSource,
  electricFanSource,
]

describe('category icon catalog', () => {
  it('uses a distinct graphic for every built-in item icon key', () => {
    const itemIcons = Object.values(itemCategoryIconUrls)

    expect(new Set(itemIcons).size).toBe(itemIcons.length)
  })

  it('uses a distinct graphic for every service category', () => {
    const serviceIcons = Object.values(serviceCategoryIconUrls)
    const detailIcons = Object.values(serviceCategoryDetailIconUrls)

    expect(new Set(serviceIcons).size).toBe(serviceIcons.length)
    expect(new Set(detailIcons).size).toBe(detailIcons.length)
    expect(detailIcons.some((icon) => serviceIcons.includes(icon))).toBe(false)
  })

  it('does not reuse an item graphic for a service category', () => {
    const itemIcons = new Set(Object.values(itemCategoryIconUrls))
    const reusedServiceIcons = Object.values(serviceCategoryIconUrls).filter((icon) => itemIcons.has(icon))

    expect(reusedServiceIcons).toEqual([])
  })

  it('uses a music-specific graphic instead of the item headphones graphic', () => {
    expect(serviceCategoryIconUrls.音乐).not.toBe(itemCategoryIconUrls.headphones)
  })

  it('maps the twelve redrawn digital-device icons in the reference order', () => {
    const digitalGroup = categoryGroups.find((group) => group.name === '数码')

    expect(digitalGroup?.items.map((item) => item.name)).toEqual([
      '手机',
      '笔记本',
      '平板',
      '耳机',
      '智能手表',
      '台式电脑',
      '显示器',
      '相机',
      '游戏设备',
      '音箱',
      '键盘',
      '鼠标',
    ])
    expect(digitalGroup?.items.map((item) => item.iconKey)).toEqual([
      'phone',
      'laptop',
      'tablet',
      'headphones',
      'smart-watch',
      'desktop',
      'monitor',
      'camera',
      'game-device',
      'speaker',
      'keyboard',
      'mouse',
    ])
  })

  it('keeps every redrawn digital-device SVG distinct and code-native', () => {
    expect(digitalItemSources).toHaveLength(12)
    expect(new Set(digitalItemSources).size).toBe(12)

    for (const source of digitalItemSources) {
      expect(source).toContain('viewBox="0 0 48 48"')
      expect(source).toContain('stroke-width="3"')
      expect(source).not.toContain('<text')
      expect(source).not.toContain('<image')
    }
  })

  it('keeps the refined digital controls clean at compact size', () => {
    expect(smartWatchSource).toContain('M18.5 12V4.5h11V12')
    expect(smartWatchSource).not.toContain('m17 13')
    expect(gameConsoleSource).toContain('stroke-width="2"')
    expect(gameConsoleSource).toContain('x="20" y="18" width="8" height="8"')
    expect(gameConsoleSource).toContain('M10 22h6M13 19v6" stroke-width="2"')
    expect(gameConsoleSource).toContain('cy="18"')
    expect(keyboardSource).toContain('M12 25h3M19 25h3M26 25h3M33 25h3')
    expect(keyboardSource).not.toContain('M10 25')
  })

  it('maps the twelve redrawn appliance icons in the reference order', () => {
    const applianceGroup = categoryGroups.find((group) => group.name === '家电')

    expect(applianceGroup?.items.slice(0, 12).map((item) => item.name)).toEqual([
      '冰箱',
      '空调',
      '洗衣机',
      '电视',
      '热水器',
      '微波炉',
      '电饭煲',
      '烤箱',
      '吸尘器',
      '扫地机器人',
      '空气净化器',
      '电风扇',
    ])
    expect(applianceGroup?.items.slice(0, 12).map((item) => item.iconKey)).toEqual([
      'refrigerator',
      'air-conditioner',
      'washing-machine',
      'television',
      'water-heater',
      'microwave',
      'rice-cooker',
      'oven',
      'vacuum-cleaner',
      'robot-vacuum',
      'air-purifier',
      'electric-fan',
    ])
  })

  it('keeps every redrawn appliance SVG distinct and code-native', () => {
    expect(applianceItemSources).toHaveLength(12)
    expect(new Set(applianceItemSources).size).toBe(12)

    for (const source of applianceItemSources) {
      expect(source).toContain('viewBox="0 0 48 48"')
      expect(source).toContain('stroke-width="3"')
      expect(source).not.toContain('<text')
      expect(source).not.toContain('<image')
    }
  })

  it('removes appliance feet and prevents the vacuum stem from doubling', () => {
    expect(refrigeratorSource).not.toContain('43.5v1')
    expect(airPurifierSource).not.toContain('43.5v1')
    expect(vacuumCleanerSource).toContain('M24 21v16.8')
    expect(vacuumCleanerSource).toContain('r="1"')
    expect(vacuumCleanerSource).not.toContain('M22 20v19M26 20v19')
    expect(electricFanSource).toContain('rotate(120 24 20)')
    expect(electricFanSource).toContain('rotate(240 24 20)')
  })

  it('gives the cloud three distinct lobes at compact and detail sizes', () => {
    for (const source of [cloudCompactSource, cloudDetailSource]) {
      expect(source).toContain('a8.8 8.8')
      expect(source).toContain('6.5 6.5')
      expect(source).toContain('A6.2 6.2')
    }
  })

  it('migrates the former combined appliance categories to their new equivalents', () => {
    expect(normalizeCategoryPair('家电', '微波炉/烤箱')).toEqual({
      category: '家电',
      subcategory: '微波炉',
    })
    expect(normalizeCategoryPair('家电', '厨房小电')).toEqual({
      category: '家电',
      subcategory: '电饭煲',
    })
    expect(normalizeCategoryPair('家电', '风扇/取暖器')).toEqual({
      category: '家电',
      subcategory: '电风扇',
    })
    expect(normalizeCategoryPair('家电', '吸尘器/扫地机器人')).toEqual({
      category: '家电',
      subcategory: '扫地机器人',
    })
  })

  it('locks service glyphs to the compact and detail size tokens', () => {
    const { container, rerender } = render(<ServiceCategoryGlyph category="AI服务" />)
    const compactGlyph = container.querySelector<HTMLElement>('.service-category-glyph')

    expect(compactGlyph?.style.getPropertyValue('--catalog-glyph-size')).toBe('28px')
    expect(compactGlyph?.style.getPropertyValue('--catalog-glyph-url')).toBe(
      `url("${serviceCategoryIconUrls.AI服务}")`,
    )

    rerender(<ServiceCategoryGlyph category="AI服务" variant="detail" />)
    const detailGlyph = container.querySelector<HTMLElement>('.service-category-glyph')

    expect(detailGlyph?.style.getPropertyValue('--catalog-glyph-size')).toBe('42px')
    expect(detailGlyph?.style.getPropertyValue('--catalog-glyph-url')).toBe(
      `url("${serviceCategoryDetailIconUrls.AI服务}")`,
    )
  })

  it('locks item glyphs to the same compact and detail size tokens', () => {
    const { container, rerender } = render(<ItemCategoryGlyph iconKey="phone" />)
    const compactGlyph = container.querySelector<HTMLElement>('.item-category-glyph')

    expect(compactGlyph?.style.getPropertyValue('--catalog-glyph-size')).toBe('28px')
    expect(compactGlyph?.style.getPropertyValue('--catalog-glyph-url')).toBe(
      `url("${itemCategoryIconUrls.phone}")`,
    )

    rerender(<ItemCategoryGlyph iconKey="phone" variant="detail" />)
    const detailGlyph = container.querySelector<HTMLElement>('.item-category-glyph')

    expect(detailGlyph?.style.getPropertyValue('--catalog-glyph-size')).toBe('42px')
    expect(detailGlyph?.style.getPropertyValue('--catalog-glyph-url')).toBe(
      `url("${itemCategoryIconUrls.phone}")`,
    )
  })

  it('adds optical compensation without changing the compact and detail size tokens', () => {
    const { container, rerender } = render(<ItemCategoryGlyph iconKey="keyboard" />)
    const keyboardGlyph = container.querySelector<HTMLElement>('.item-category-glyph')

    expect(keyboardGlyph?.style.getPropertyValue('--catalog-glyph-size')).toBe('28px')
    expect(keyboardGlyph?.style.getPropertyValue('--catalog-glyph-optical-scale')).toBe('1.08')

    rerender(<ServiceCategoryGlyph category="学习教育" variant="detail" />)
    const learningGlyph = container.querySelector<HTMLElement>('.service-category-glyph')

    expect(learningGlyph?.style.getPropertyValue('--catalog-glyph-size')).toBe('42px')
    expect(learningGlyph?.style.getPropertyValue('--catalog-glyph-optical-scale')).toBe('1.06')
  })

  it('keeps the compact and detail AI glyphs free of the removed star', () => {
    for (const source of [aiCompactSource, aiDetailSource]) {
      expect(source).not.toContain('fill="#000"')
      expect(source).not.toContain('stroke="none"')
    }
  })

  it('uses a graduation cap with one short tassel line for learning', () => {
    for (const source of [learningCompactSource, learningDetailSource]) {
      expect(source.match(/<path /g)).toHaveLength(3)
      expect(source).toContain('M4.5 17 24 7l19.5 10L24 27 4.5 17Z')
      expect(source).toContain('M40 19v8')
      expect(source).not.toContain('<circle')
    }
  })
})
