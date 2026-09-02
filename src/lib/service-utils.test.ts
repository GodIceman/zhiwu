import { describe, expect, it } from 'vitest'
import type { Asset } from '../types'
import {
  calculateServiceDailyCost,
  computeService,
  deriveNextServiceEventDate,
  formatServicePayment,
  summarizeServices,
} from './service-utils'

const service: Asset = {
  id: 'service-1',
  kind: 'service',
  name: '智能助手 Pro',
  category: '其他',
  subcategory: '待分类',
  valueTrackingEnabled: false,
  purchasePriceCny: 0,
  purchaseDate: '2026-07-17',
  photoDataUrl: '',
  note: '',
  serviceCategory: 'AI服务',
  billingMode: 'subscription',
  serviceAmountCny: 1200,
  billingCycle: 'yearly',
  nextEventDate: '2026-08-17',
  autoRenew: true,
  reminderDays: 7,
  planName: 'Pro',
  usageTags: ['对话'],
  createdAt: '',
  updatedAt: '',
}

function makeService(overrides: Partial<Asset>): Asset {
  return {
    ...service,
    id: String(overrides.id ?? crypto.randomUUID()),
    ...overrides,
  }
}

describe('service calculations', () => {
  it('keeps legacy annual subscriptions compatible', () => {
    const computed = computeService(service, '2026-07-17')
    expect(computed.dailyCost).toBeCloseTo(1200 / 365)
    expect(computed.monthlyEquivalentCny).toBe(100)
  })

  it('normalizes monthly and yearly payments into one daily unit', () => {
    const monthly = makeService({
      billingMode: 'monthly',
      serviceAmountCny: 148,
    })
    const yearly = makeService({
      billingMode: 'yearly',
      serviceAmountCny: 1188,
    })

    expect(calculateServiceDailyCost(monthly, '2026-07-17')).toBeCloseTo(148 * 12 / 365)
    expect(computeService(monthly, '2026-07-17').monthlyEquivalentCny).toBe(148)
    expect(calculateServiceDailyCost(yearly, '2026-07-17')).toBeCloseTo(1188 / 365)
    expect(computeService(yearly, '2026-07-17').monthlyEquivalentCny).toBe(99)
  })

  it('spreads a one-time payment over its inclusive validity period', () => {
    const oneTime = makeService({
      billingMode: 'one-time',
      serviceAmountCny: 100,
      purchaseDate: '2026-07-01',
      nextEventDate: '2026-07-10',
      autoRenew: false,
    })

    expect(computeService(oneTime, '2026-07-05').dailyCost).toBe(10)
  })

  it('spreads an open-ended one-time payment over days used so far', () => {
    const oneTime = makeService({
      billingMode: 'one-time',
      serviceAmountCny: 100,
      purchaseDate: '2026-07-01',
      nextEventDate: '',
      autoRenew: false,
    })

    expect(computeService(oneTime, '2026-07-10').dailyCost).toBe(10)
  })

  it('always reports a free service as zero cost', () => {
    const free = makeService({
      billingMode: 'free',
      serviceAmountCny: 999,
    })

    expect(computeService(free, '2026-07-17').dailyCost).toBe(0)
    expect(computeService(free, '2026-07-17').monthlyEquivalentCny).toBe(0)
    expect(formatServicePayment(free)).toBe('免费')
  })

  it('derives a future calendar date for an overdue auto-renewal', () => {
    const monthly = makeService({
      billingMode: 'monthly',
      serviceAmountCny: 30,
      nextEventDate: '2026-01-31',
      autoRenew: true,
    })
    const computed = computeService(monthly, '2026-03-01')

    expect(deriveNextServiceEventDate(monthly, '2026-03-01')).toBe('2026-03-31')
    expect(computed.originalNextEventDate).toBe('2026-01-31')
    expect(computed.nextEventDate).toBe('2026-03-31')
    expect(computed.eventDays).toBe(30)
  })

  it('does not advance an overdue manual renewal', () => {
    const manual = makeService({
      billingMode: 'monthly',
      nextEventDate: '2026-06-01',
      autoRenew: false,
    })

    expect(computeService(manual, '2026-07-17').nextEventDate).toBe('2026-06-01')
    expect(computeService(manual, '2026-07-17').eventDays).toBe(-46)
  })

  it('summarizes daily/monthly cost and auto-renewals in the next 30 days', () => {
    const monthly = makeService({
      id: 'monthly',
      billingMode: 'monthly',
      serviceAmountCny: 120,
      nextEventDate: '2026-07-20',
      autoRenew: true,
    })
    const yearlyOutsideWindow = makeService({
      id: 'yearly',
      billingMode: 'yearly',
      serviceAmountCny: 1200,
      nextEventDate: '2026-08-17',
      autoRenew: true,
    })
    const manual = makeService({
      id: 'manual',
      billingMode: 'monthly',
      serviceAmountCny: 50,
      nextEventDate: '2026-07-25',
      autoRenew: false,
    })
    const summary = summarizeServices([monthly, yearlyOutsideWindow, manual], '2026-07-17')

    expect(summary.dailySpend).toBeCloseTo((120 * 12 + 1200 + 50 * 12) / 365)
    expect(summary.monthlySpend).toBe(270)
    expect(summary.annualEstimate).toBe(3240)
    expect(summary.next30DaysRenewalSpend).toBe(120)
    expect(summary.nextService?.id).toBe('monthly')
  })

  it('formats the true amount and payment period', () => {
    expect(formatServicePayment(makeService({
      billingMode: 'monthly',
      serviceAmountCny: 148,
    }))).toBe('¥148/月')
    expect(formatServicePayment(makeService({
      billingMode: 'yearly',
      serviceAmountCny: 1188,
    }))).toBe('¥1,188/年')
    expect(formatServicePayment(makeService({
      billingMode: 'one-time',
      serviceAmountCny: 498,
    }))).toBe('¥498一次性')
  })

  it('does not throw on malformed legacy dates', () => {
    const malformed = makeService({
      billingMode: 'fixed',
      purchaseDate: 'not-a-date',
      nextEventDate: '2026-99-99',
    })

    expect(() => computeService(malformed, '2026-07-17')).not.toThrow()
    expect(computeService(malformed, '2026-07-17').eventDays).toBeNull()
    expect(computeService(malformed, '2026-07-17').dailyCost).toBe(0)
  })
})
