import { describe, expect, it } from 'vitest'
import { createDemoAssets } from './demo-data'

describe('createDemoAssets', () => {
  it('creates privacy-safe item and service examples', () => {
    const assets = createDemoAssets(new Date('2026-09-02T12:00:00+08:00'))

    expect(assets).toHaveLength(7)
    expect(assets.filter((asset) => asset.kind === 'service')).toHaveLength(3)
    expect(assets.every((asset) => asset.id.startsWith('demo-'))).toBe(true)
    expect(assets.map((asset) => asset.name)).not.toContain('MacBook Pro')
    expect(assets.find((asset) => asset.id === 'demo-ai-assistant')?.nextEventDate).toBe('2026-09-20')
  })
})
