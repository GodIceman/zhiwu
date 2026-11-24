import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { toLocalDateKey } from '../lib/date'

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']

type ThemeDatePickerProps = {
  value: string
  onChange: (value: string) => void
  label: string
  min?: string
  max?: string
  placeholder?: string
  allowClear?: boolean
}

type CalendarCell = {
  dateKey: string
  day: number
  inCurrentMonth: boolean
}

function parseDateKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(year, month, day)

  if (
    date.getFullYear() !== year
    || date.getMonth() !== month
    || date.getDate() !== day
  ) {
    return null
  }

  return date
}

function formatDateLabel(dateKey: string) {
  const date = parseDateKey(dateKey)
  if (!date) return dateKey
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

function getMonthCells(year: number, month: number): CalendarCell[] {
  const firstDay = new Date(year, month, 1)
  const mondayOffset = (firstDay.getDay() + 6) % 7
  const gridStart = new Date(year, month, 1 - mondayOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)

    return {
      dateKey: toLocalDateKey(date),
      day: date.getDate(),
      inCurrentMonth: date.getMonth() === month,
    }
  })
}

function isDateAllowed(dateKey: string, min?: string, max?: string) {
  if (min && dateKey < min) return false
  if (max && dateKey > max) return false
  return true
}

function getInitialMonth(value: string, min?: string, max?: string) {
  const preferred = parseDateKey(value) ?? new Date()
  let dateKey = toLocalDateKey(preferred)

  if (min && dateKey < min) dateKey = min
  if (max && dateKey > max) dateKey = max

  return parseDateKey(dateKey) ?? new Date()
}

export function ThemeDatePicker({
  value,
  onChange,
  label,
  min,
  max,
  placeholder = '选择日期',
  allowClear = true,
}: ThemeDatePickerProps) {
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null)
  const isOpen = portalHost !== null
  const [view, setView] = useState<'days' | 'years'>('days')
  const initialMonth = getInitialMonth(value, min, max)
  const [visibleYear, setVisibleYear] = useState(initialMonth.getFullYear())
  const [visibleMonth, setVisibleMonth] = useState(initialMonth.getMonth())
  const selectedYearRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const today = toLocalDateKey()

  const cells = useMemo(
    () => getMonthCells(visibleYear, visibleMonth),
    [visibleMonth, visibleYear],
  )

  const minYear = parseDateKey(min ?? '')?.getFullYear() ?? new Date().getFullYear() - 80
  const maxYear = parseDateKey(max ?? '')?.getFullYear() ?? new Date().getFullYear() + 30
  const years = useMemo(
    () => Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index),
    [maxYear, minYear],
  )

  useLayoutEffect(() => {
    if (!isOpen) return
    const trigger = triggerRef.current
    const form = trigger?.closest<HTMLElement>('[role="dialog"]')
    dialogRef.current?.focus({ preventScroll: true })
    if (form) {
      form.inert = true
      form.setAttribute('aria-hidden', 'true')
    }
    return () => {
      if (form) {
        form.inert = false
        form.removeAttribute('aria-hidden')
      }
      if (trigger?.isConnected && !trigger.closest('[inert]')) trigger.focus({ preventScroll: true })
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !dialogRef.current?.closest('[inert]')) setPortalHost(null)
    }
    const handleNativeBack = () => setPortalHost(null)

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('zhiwu:close-date-picker', handleNativeBack)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('zhiwu:close-date-picker', handleNativeBack)
    }
  }, [isOpen])

  useEffect(() => {
    if (view !== 'years') return
    selectedYearRef.current?.scrollIntoView({ block: 'center' })
  }, [view])

  function moveMonth(offset: number) {
    const next = new Date(visibleYear, visibleMonth + offset, 1)
    setVisibleYear(next.getFullYear())
    setVisibleMonth(next.getMonth())
  }

  function monthIsAvailable(offset: number) {
    const month = new Date(visibleYear, visibleMonth + offset, 1)
    const monthStart = toLocalDateKey(month)
    const monthEnd = toLocalDateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0))
    return (!min || monthEnd >= min) && (!max || monthStart <= max)
  }

  function selectDate(dateKey: string) {
    if (!isDateAllowed(dateKey, min, max)) return
    onChange(dateKey)
    setPortalHost(null)
  }

  function openPicker() {
    const nextMonth = getInitialMonth(value, min, max)
    setVisibleYear(nextMonth.getFullYear())
    setVisibleMonth(nextMonth.getMonth())
    setView('days')
    setPortalHost(triggerRef.current?.closest<HTMLElement>('.app-frame') ?? document.body)
  }

  const dialog = isOpen ? (
    <div
      className="date-picker-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setPortalHost(null)
      }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="date-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`选择${label}`}
      >
        <header className="date-picker-header">
          <div>
            <span>{label}</span>
            <strong>{value ? formatDateLabel(value) : '请选择日期'}</strong>
          </div>
          <button
            className="date-picker-close"
            type="button"
            onClick={() => setPortalHost(null)}
            aria-label="关闭日期选择"
          >
            <X size={18} />
          </button>
        </header>

        <div className="date-picker-month-bar">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            disabled={!monthIsAvailable(-1)}
            aria-label="上个月"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            className="date-picker-month-title"
            type="button"
            onClick={() => setView((current) => current === 'days' ? 'years' : 'days')}
            aria-expanded={view === 'years'}
          >
            {visibleYear}年 {visibleMonth + 1}月
            <ChevronDown size={15} />
          </button>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            disabled={!monthIsAvailable(1)}
            aria-label="下个月"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {view === 'years' ? (
          <div className="date-picker-year-grid" aria-label="选择年份">
            {years.map((year) => (
              <button
                key={year}
                ref={year === visibleYear ? selectedYearRef : undefined}
                className={year === visibleYear ? 'selected' : ''}
                type="button"
                onClick={() => {
                  setVisibleYear(year)
                  setView('days')
                }}
              >
                {year}
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="date-picker-weekdays" aria-hidden="true">
              {weekdayLabels.map((weekday) => <span key={weekday}>{weekday}</span>)}
            </div>
            <div className="date-picker-days">
              {cells.map((cell) => {
                const selected = cell.dateKey === value
                const isToday = cell.dateKey === today
                const disabled = !isDateAllowed(cell.dateKey, min, max)
                const classNames = [
                  !cell.inCurrentMonth ? 'outside' : '',
                  selected ? 'selected' : '',
                  isToday ? 'today' : '',
                ].filter(Boolean).join(' ')

                return (
                  <button
                    key={cell.dateKey}
                    className={classNames}
                    type="button"
                    disabled={disabled}
                    onClick={() => selectDate(cell.dateKey)}
                    aria-label={formatDateLabel(cell.dateKey)}
                    aria-pressed={selected}
                  >
                    <span>{cell.day}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}

        <footer className="date-picker-actions">
          {allowClear && (
            <button
              type="button"
              onClick={() => {
                onChange('')
                setPortalHost(null)
              }}
              disabled={!value}
            >
              清除
            </button>
          )}
          <span />
          <button type="button" onClick={() => setPortalHost(null)}>取消</button>
          <button
            className="primary"
            type="button"
            disabled={!isDateAllowed(today, min, max)}
            onClick={() => selectDate(today)}
          >
            今天
          </button>
        </footer>
      </section>
    </div>
  ) : null

  return (
    <>
      <button
        ref={triggerRef}
        className={value ? 'date-field-trigger has-value' : 'date-field-trigger'}
        type="button"
        onClick={openPicker}
        aria-label={`${label}：${value ? formatDateLabel(value) : placeholder}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span>{value ? formatDateLabel(value) : placeholder}</span>
        <CalendarDays size={17} aria-hidden="true" />
      </button>
      {dialog && portalHost && createPortal(dialog, portalHost)}
    </>
  )
}
