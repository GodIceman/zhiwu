import type { Asset, BillingCycle, BillingMode } from '../types'
import { addLocalDays, diffLocalDays, parseLocalDateKey, toLocalDateKey } from './date'
import { formatCny } from './calculations'

const daysPerYear = 365
const monthsPerYear = 12

export const billingModeLabels: Record<BillingMode, string> = {
  monthly: '月付',
  yearly: '年付',
  'one-time': '一次购买',
  free: '免费',
  subscription: '周期订阅',
  fixed: '固定期限',
  credit: '额度包',
  usage: '按量计费',
}

export const billingCycleLabels: Record<BillingCycle, string> = {
  weekly: '周付',
  monthly: '月付',
  quarterly: '季付',
  yearly: '年付',
  custom: '自定义',
}

export interface ComputedService extends Asset {
  kind: 'service'
  /** The original date is retained so computing a service never mutates stored data. */
  originalNextEventDate: string
  /** Auto-renewing dates in the past are advanced to the current or next cycle. */
  effectiveNextEventDate: string
  eventDays: number | null
  /** Cost normalized to one day, shared by every supported payment type. */
  dailyCost: number
  monthlyEquivalentCny: number
}

export interface ServiceSummary {
  serviceCount: number
  dailySpend: number
  monthlySpend: number
  annualEstimate: number
  next30DaysRenewalSpend: number
  nextService: ComputedService | null
}

type Recurrence =
  | { unit: 'day'; interval: number }
  | { unit: 'month'; interval: number }

export function computeService(service: Asset, todayKey = toLocalDateKey()): ComputedService {
  const originalNextEventDate = String(service.nextEventDate || '')
  const effectiveNextEventDate = deriveNextServiceEventDate(service, todayKey)
  const eventDays = safeDiffLocalDays(todayKey, effectiveNextEventDate)

  return {
    ...service,
    kind: 'service',
    originalNextEventDate,
    nextEventDate: effectiveNextEventDate,
    effectiveNextEventDate,
    eventDays,
    dailyCost: calculateServiceDailyCost(service, todayKey),
    monthlyEquivalentCny: calculateMonthlyEquivalent(service, todayKey),
  }
}

export function summarizeServices(services: Asset[], todayKey = toLocalDateKey()): ServiceSummary {
  const computed = services
    .filter((asset) => asset.kind === 'service')
    .map((asset) => computeService(asset, todayKey))
  const sorted = sortServicesByEvent(computed)
  const dailySpend = computed.reduce((total, service) => total + service.dailyCost, 0)
  const monthlySpend = computed.reduce((total, service) => total + service.monthlyEquivalentCny, 0)
  const next30DaysRenewalSpend = computed.reduce((total, service) => {
    if (!isAutoRenewingService(service)) return total
    if (service.eventDays === null || service.eventDays < 0 || service.eventDays > 30) return total
    return total + getServiceAmount(service)
  }, 0)

  return {
    serviceCount: computed.length,
    dailySpend,
    monthlySpend,
    annualEstimate: monthlySpend * monthsPerYear,
    next30DaysRenewalSpend,
    nextService: sorted.find((service) => (service.eventDays ?? -1) >= 0) ?? sorted[0] ?? null,
  }
}

export function sortServicesByEvent(services: ComputedService[]) {
  return [...services].sort((a, b) => {
    const aDays = a.eventDays
    const bDays = b.eventDays

    if (aDays === null && bDays === null) return a.name.localeCompare(b.name, 'zh-CN')
    if (aDays === null) return 1
    if (bDays === null) return -1
    if (aDays >= 0 && bDays < 0) return -1
    if (aDays < 0 && bDays >= 0) return 1

    return aDays - bDays
  })
}

/**
 * Normalizes the payment amount into a daily cost.
 *
 * A one-time purchase with an end date is spread across its full inclusive
 * validity period. Without an end date it is spread across inclusive days
 * used so far, matching how physical-item holding days are presented.
 */
export function calculateServiceDailyCost(service: Asset, todayKey = toLocalDateKey()) {
  const amount = getServiceAmount(service)
  const mode = service.billingMode ?? 'subscription'

  if (mode === 'free') return 0
  if (mode === 'monthly') return amount * monthsPerYear / daysPerYear
  if (mode === 'yearly') return amount / daysPerYear
  if (mode === 'one-time') return calculateOneTimeDailyCost(service, amount, todayKey)

  // Compatibility for records created before the simplified payment choices.
  if (mode === 'usage') return amount * monthsPerYear / daysPerYear
  if (mode === 'subscription') {
    const cycle = service.billingCycle ?? 'monthly'
    if (cycle === 'weekly') return amount * 52 / daysPerYear
    if (cycle === 'quarterly') return amount * 4 / daysPerYear
    if (cycle === 'yearly') return amount / daysPerYear
    return amount * monthsPerYear / daysPerYear
  }

  return calculateOneTimeDailyCost(service, amount, todayKey)
}

export function calculateMonthlyEquivalent(service: Asset, todayKey = toLocalDateKey()) {
  const amount = getServiceAmount(service)
  const mode = service.billingMode ?? 'subscription'

  if (mode === 'free') return 0
  if (mode === 'monthly' || mode === 'usage') return amount
  if (mode === 'yearly') return amount / monthsPerYear

  if (mode === 'subscription') {
    const cycle = service.billingCycle ?? 'monthly'
    if (cycle === 'weekly') return amount * 52 / monthsPerYear
    if (cycle === 'quarterly') return amount / 3
    if (cycle === 'yearly') return amount / monthsPerYear
    return amount
  }

  return calculateServiceDailyCost(service, todayKey) * daysPerYear / monthsPerYear
}

/**
 * Advances a stale auto-renew date for display and summaries. Manual renewals,
 * one-time purchases, free services and unsupported custom legacy cycles keep
 * their original date so an overdue event remains visible.
 */
export function deriveNextServiceEventDate(service: Asset, todayKey = toLocalDateKey()) {
  const nextEventDate = validDateKey(service.nextEventDate)
  const today = validDateKey(todayKey)

  if (!nextEventDate || !today) return ''
  if (!isAutoRenewingService(service) || nextEventDate >= today) return nextEventDate

  const recurrence = getRecurrence(service)
  if (!recurrence) return nextEventDate

  if (recurrence.unit === 'day') {
    const elapsedDays = safeDiffLocalDays(nextEventDate, today) ?? 0
    const cycles = Math.ceil(elapsedDays / recurrence.interval)
    return addLocalDays(nextEventDate, cycles * recurrence.interval)
  }

  const from = parseLocalDateKey(nextEventDate)
  const to = parseLocalDateKey(today)
  const elapsedMonths = (to.getFullYear() - from.getFullYear()) * monthsPerYear
    + to.getMonth() - from.getMonth()
  let cycles = Math.max(1, Math.floor(elapsedMonths / recurrence.interval))
  let candidate = addCalendarMonths(nextEventDate, cycles * recurrence.interval)

  if (candidate < today) {
    cycles += 1
    candidate = addCalendarMonths(nextEventDate, cycles * recurrence.interval)
  }

  return candidate
}

export function isAutoRenewingService(
  service: Pick<Asset, 'billingMode' | 'autoRenew'>,
) {
  const mode = service.billingMode ?? 'subscription'
  return (mode === 'monthly' || mode === 'yearly' || mode === 'subscription')
    && service.autoRenew !== false
}

export function formatServicePayment(
  service: Pick<Asset, 'billingMode' | 'billingCycle' | 'serviceAmountCny'>,
) {
  const mode = service.billingMode ?? 'subscription'
  if (mode === 'free') return '免费'

  const amount = formatCny(getServiceAmount(service)).replace(/\.00$/, '')
  if (mode === 'monthly') return `${amount}/月`
  if (mode === 'yearly') return `${amount}/年`
  if (mode === 'one-time' || mode === 'fixed') return `${amount}一次性`
  if (mode === 'credit') return `${amount}/额度包`
  if (mode === 'usage') return `${amount}按量`

  const cycle = service.billingCycle ?? 'monthly'
  if (cycle === 'weekly') return `${amount}/周`
  if (cycle === 'quarterly') return `${amount}/季`
  if (cycle === 'yearly') return `${amount}/年`
  if (cycle === 'custom') return `${amount}/周期`
  return `${amount}/月`
}

export function formatServiceCountdown(eventDays: number | null) {
  if (eventDays === null) return '待补充'
  if (eventDays < 0) return '已过期'
  if (eventDays === 0) return '今天'
  return `${eventDays}天后`
}

export function getServiceEventNoun(mode: BillingMode | undefined) {
  if (mode === 'one-time' || mode === 'free' || mode === 'fixed') return '到期'
  if (mode === 'credit') return '额度重置'
  if (mode === 'usage') return '结算'
  return '续费'
}

export function getServiceEventDescription(
  service: Pick<Asset, 'billingMode' | 'autoRenew' | 'nextEventDate'>,
) {
  if (!service.nextEventDate) return '待补充到期日'

  const date = service.nextEventDate
  const noun = getServiceEventNoun(service.billingMode)

  if (
    service.billingMode === 'monthly'
    || service.billingMode === 'yearly'
    || service.billingMode === 'subscription'
    || service.billingMode === undefined
  ) {
    return `${date}${service.autoRenew === false ? '到期' : '自动续费'}`
  }

  return `${date}${noun}`
}

function calculateOneTimeDailyCost(service: Asset, amount: number, todayKey: string) {
  const startDate = validDateKey(service.purchaseDate)
  if (!startDate) return 0

  const endDate = validDateKey(service.nextEventDate)
  const validityDays = endDate && endDate >= startDate
    ? (safeDiffLocalDays(startDate, endDate) ?? 0) + 1
    : (safeDiffLocalDays(startDate, todayKey) ?? 0) + 1

  return amount / Math.max(1, validityDays)
}

function getServiceAmount(service: Pick<Asset, 'serviceAmountCny'>) {
  return Math.max(0, Number(service.serviceAmountCny) || 0)
}

function getRecurrence(service: Pick<Asset, 'billingMode' | 'billingCycle'>): Recurrence | null {
  const mode = service.billingMode ?? 'subscription'
  if (mode === 'monthly') return { unit: 'month', interval: 1 }
  if (mode === 'yearly') return { unit: 'month', interval: monthsPerYear }
  if (mode !== 'subscription') return null

  const cycle = service.billingCycle ?? 'monthly'
  if (cycle === 'weekly') return { unit: 'day', interval: 7 }
  if (cycle === 'monthly') return { unit: 'month', interval: 1 }
  if (cycle === 'quarterly') return { unit: 'month', interval: 3 }
  if (cycle === 'yearly') return { unit: 'month', interval: monthsPerYear }
  return null
}

function addCalendarMonths(dateKey: string, months: number) {
  const date = parseLocalDateKey(dateKey)
  const targetMonthFirst = new Date(date.getFullYear(), date.getMonth() + months, 1)
  const lastDay = new Date(
    targetMonthFirst.getFullYear(),
    targetMonthFirst.getMonth() + 1,
    0,
  ).getDate()
  const target = new Date(
    targetMonthFirst.getFullYear(),
    targetMonthFirst.getMonth(),
    Math.min(date.getDate(), lastDay),
  )

  return toLocalDateKey(target)
}

function safeDiffLocalDays(fromDateKey: string, toDateKey: string) {
  const from = validDateKey(fromDateKey)
  const to = validDateKey(toDateKey)
  if (!from || !to) return null
  return diffLocalDays(from, to)
}

function validDateKey(value: unknown) {
  const dateKey = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return ''

  try {
    return toLocalDateKey(parseLocalDateKey(dateKey)) === dateKey ? dateKey : ''
  } catch {
    return ''
  }
}
