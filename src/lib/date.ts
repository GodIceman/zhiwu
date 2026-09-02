const dayMs = 24 * 60 * 60 * 1000

const pad = (value: number) => String(value).padStart(2, '0')

export function toLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseLocalDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)

  if (!year || !month || !day) {
    throw new Error(`Invalid local date key: ${dateKey}`)
  }

  return new Date(year, month - 1, day)
}

export function diffLocalDays(fromDateKey: string, toDateKey: string) {
  const from = parseLocalDateKey(fromDateKey)
  const to = parseLocalDateKey(toDateKey)

  return Math.round((to.getTime() - from.getTime()) / dayMs)
}

export function addLocalDays(dateKey: string, days: number) {
  const date = parseLocalDateKey(dateKey)
  date.setDate(date.getDate() + days)

  return toLocalDateKey(date)
}

export function isFutureLocalDate(dateKey: string, todayKey = toLocalDateKey()) {
  return diffLocalDays(todayKey, dateKey) > 0
}
