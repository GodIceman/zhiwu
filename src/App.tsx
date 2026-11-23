import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Keyboard, KeyboardStyle } from '@capacitor/keyboard'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Icon as MdiIcon } from '@mdi/react'
import {
  mdiArchive,
  mdiCog,
  mdiHomeVariant,
} from '@mdi/js'
import {
  Archive,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Download,
  Edit3,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import './App.css'
import { AboutSettings } from './components/AboutSettings'
import { ThemeDatePicker } from './components/ThemeDatePicker'
import { CustomKindGlyph, ItemCategoryGlyph, ServiceCategoryGlyph } from './icons/category-icons'
import { InsightBulbIcon } from './icons/insight-bulb-icon'
import { filterAssets, sortComputedAssets, type SortKey } from './lib/asset-utils'
import { buildCsv, createBackup, parseBackup } from './lib/backup'
import {
  computeAsset,
  formatAssetDailyCost,
  formatCny,
  formatDailyCny,
  summarizePortfolio,
  type ComputedAsset,
} from './lib/calculations'
import { isFutureLocalDate, toLocalDateKey } from './lib/date'
import { createDemoAssets } from './lib/demo-data'
import { downloadTextFile } from './lib/download'
import { IosNative } from './lib/ios-native'
import {
  defaultSettings,
  clearDemoAssets,
  deleteAsset,
  initializeFreshData,
  loadAssets,
  loadSettings,
  replaceAllData,
  saveAsset,
  saveSettings,
  updateCustomSubcategory,
} from './lib/storage'
import {
  billingCycleLabels,
  billingModeLabels,
  computeService,
  formatServicePayment,
  formatServiceCountdown,
  getServiceEventDescription,
  getServiceEventNoun,
  sortServicesByEvent,
  summarizeServices,
  type ComputedService,
} from './lib/service-utils'
import {
  activeItemCategories,
  defaultCategory,
  defaultSubcategory,
  getCategoryGroups,
  getCategoryDisplayName,
  getSelectableCategoryGroups,
  getDefaultSubcategory,
  getSubcategoryDisplayName,
  getSubcategoryMeta,
  serviceCategories,
  type AiUsageTag,
  type Asset,
  type AssetFormValues,
  type BillingMode,
  type Category,
  type CategoryItem,
  type CustomSubcategory,
  type RecordKind,
  type ServiceCategory,
  type Settings,
  type Subcategory,
} from './types'

type TabKey = 'home' | 'assets' | 'settings'
type ServiceSortKey = 'daily-desc' | 'daily-asc' | 'event-asc' | 'amount-desc' | 'name-asc'

type AppDialogState = {
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
}

type SortOption<T extends string> = {
  value: T
  label: string
}

const itemSortOptions: SortOption<SortKey>[] = [
  { value: 'daily-desc', label: '日均从高到低' },
  { value: 'daily-asc', label: '日均从低到高' },
  { value: 'date-desc', label: '拥有日期最新' },
  { value: 'price-desc', label: '购入金额从高到低' },
  { value: 'price-asc', label: '购入金额从低到高' },
  { value: 'name-asc', label: '名称排序' },
]

const serviceSortOptions: SortOption<ServiceSortKey>[] = [
  { value: 'daily-desc', label: '日均从高到低' },
  { value: 'daily-asc', label: '日均从低到高' },
  { value: 'event-asc', label: '续费日期最近' },
  { value: 'amount-desc', label: '实际费用从高到低' },
  { value: 'name-asc', label: '名称排序' },
]

const mvpCategories: readonly Category[] = activeItemCategories

const emptyForm: AssetFormValues = {
  kind: 'item',
  name: '',
  category: defaultCategory,
  subcategory: defaultSubcategory,
  valueTrackingEnabled: true,
  purchasePriceCny: '',
  purchaseDate: '',
  photoDataUrl: '',
  note: '',
  serviceCategory: '其他',
  billingMode: 'monthly',
  serviceAmountCny: '',
  billingCycle: 'monthly',
  nextEventDate: '',
  autoRenew: true,
  reminderDays: '3',
  planName: '',
  usageTags: [],
  showMoreServiceFields: false,
}

function isRecurringBillingMode(mode: BillingMode | undefined) {
  return mode === 'monthly' || mode === 'yearly' || mode === 'subscription'
}

function scrollHorizontally(element: HTMLElement, left: number, behavior: ScrollBehavior) {
  if (behavior === 'auto') {
    element.scrollLeft = left
    return
  }

  if (typeof element.scrollTo === 'function') {
    element.scrollTo({ left, behavior })
    return
  }

  element.scrollLeft = left
}

function jumpHorizontally(element: HTMLElement, left: number) {
  const previousScrollBehavior = element.style.scrollBehavior
  const previousScrollSnapType = element.style.scrollSnapType

  element.style.scrollBehavior = 'auto'
  element.style.scrollSnapType = 'none'
  element.scrollLeft = left
  element.style.scrollBehavior = previousScrollBehavior
  element.style.scrollSnapType = previousScrollSnapType
}

function filterAndSortServices(
  services: ComputedService[],
  search: string,
  category: string,
  sortKey: ServiceSortKey,
) {
  const keyword = search.trim().toLowerCase()
  const filtered = services.filter((service) => {
    const searchable = [
      service.name,
      service.note,
      service.planName,
      service.serviceCategory,
      ...(service.usageTags ?? []),
    ].filter(Boolean).join(' ').toLowerCase()
    const matchesKeyword = !keyword || searchable.includes(keyword)
    const matchesCategory = category === '全部' || service.serviceCategory === category
    return matchesKeyword && matchesCategory
  })

  if (sortKey === 'event-asc') return sortServicesByEvent(filtered)

  return [...filtered].sort((a, b) => {
    if (sortKey === 'daily-asc') return a.dailyCost - b.dailyCost
    if (sortKey === 'amount-desc') {
      return (Number(b.serviceAmountCny) || 0) - (Number(a.serviceAmountCny) || 0)
    }
    if (sortKey === 'name-asc') return a.name.localeCompare(b.name, 'zh-CN')
    return b.dailyCost - a.dailyCost
  })
}

const aiUsageTags: AiUsageTag[] = ['对话', '编程', '图像视频', '搜索研究', 'API']

type ZhiwuWindow = Window & {
  ZhiwuSystemBars?: {
    setDarkMode: (darkMode: boolean) => void
  }
  ZhiwuNativeSplash?: {
    hide: () => void
  }
}

function App() {
  const [todayKey, setTodayKey] = useState(() => toLocalDateKey())
  const [assets, setAssets] = useState<Asset[]>([])
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [activeTab, setActiveTab] = useState<TabKey>('home')
  const [homeMode, setHomeMode] = useState<RecordKind>('item')
  const [recordsMode, setRecordsMode] = useState<RecordKind>('item')
  const [isLoading, setIsLoading] = useState(true)
  const [showWelcome, setShowWelcome] = useState(false)
  const [starting, setStarting] = useState(false)
  const [storageUnavailable, setStorageUnavailable] = useState(false)
  const [prefersDark, setPrefersDark] = useState(() =>
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  )
  const [closingLayer, setClosingLayer] = useState<'form' | 'detail' | null>(null)
  const [formValues, setFormValues] = useState<AssetFormValues>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('全部')
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState('全部')
  const [sortKey, setSortKey] = useState<SortKey>('daily-desc')
  const [serviceSortKey, setServiceSortKey] = useState<ServiceSortKey>('daily-desc')
  const [appDialog, setAppDialog] = useState<AppDialogState | null>(null)
  const [appToast, setAppToast] = useState('')
  const importInputRef = useRef<HTMLInputElement>(null)
  const dialogResolverRef = useRef<((confirmed: boolean) => void) | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  useEffect(() => {
    let timer: number
    const refreshDate = () => {
      window.clearTimeout(timer)
      const now = new Date()
      setTodayKey(toLocalDateKey(now))
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      timer = window.setTimeout(refreshDate, nextMidnight.getTime() - now.getTime() + 100)
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshDate()
    }

    refreshDate()
    window.addEventListener('focus', refreshDate)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', refreshDate)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  useEffect(() => {
    async function hydrate() {
      const minimumSplash = new Promise((resolve) => window.setTimeout(resolve, 850))
      const [storedAssets, storedSettings] = await Promise.all([loadAssets(), loadSettings()])
      if (!storedSettings.hasSeededDemoData && storedAssets.length === 0) {
        setShowWelcome(true)
      }

      setAssets(storedAssets)
      setSettings(storedSettings)
      await minimumSplash
      setIsLoading(false)
    }

    hydrate().catch(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 850))
      setStorageUnavailable(true)
      setIsLoading(false)
    })
  }, [])

  useEffect(() => {
    SplashScreen.hide().catch(() => undefined)
  }, [])

  useEffect(() => {
    if (isLoading) return

    window.requestAnimationFrame(() => {
      ;(window as ZhiwuWindow).ZhiwuNativeSplash?.hide()
    })
  }, [isLoading])

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
  }, [settings.theme])

  const resolvedTheme = settings.theme === 'system' ? (prefersDark ? 'dark' : 'light') : settings.theme

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return

    const handleChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches)
    media.addEventListener('change', handleChange)

    return () => media.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    const isDark = resolvedTheme === 'dark'
    const backgroundColor = isDark ? '#111914' : '#F6F5F1'
    const isIos = Capacitor.getPlatform() === 'ios'
    const followSystem = isIos && settings.theme === 'system'
    const statusBarStyle = isDark ? Style.Dark : Style.Light

    document.documentElement.style.setProperty('--resolved-app-bg', backgroundColor)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', backgroundColor)
    ;(window as ZhiwuWindow).ZhiwuSystemBars?.setDarkMode(isDark)
    StatusBar.setOverlaysWebView({ overlay: true }).catch(() => undefined)
    StatusBar.setBackgroundColor({ color: backgroundColor }).catch(() => undefined)
    StatusBar.setStyle({ style: followSystem ? Style.Default : statusBarStyle }).catch(() => undefined)
    if (isIos) {
      void IosNative.setAppearance({ dark: isDark, followSystem }).catch(() => undefined)
      const keyboardStyle = isDark ? KeyboardStyle.Dark : KeyboardStyle.Light
      void Keyboard.setStyle({ style: followSystem ? KeyboardStyle.Default : keyboardStyle }).catch(() => undefined)
    }
  }, [resolvedTheme, settings.theme])

  const computedAssets = useMemo(
    () => assets.filter((asset) => asset.kind !== 'service').map((asset) => computeAsset(asset, settings, todayKey)),
    [assets, settings, todayKey],
  )
  const computedServices = useMemo(
    () => assets.filter((asset) => asset.kind === 'service').map((asset) => computeService(asset, todayKey)),
    [assets, todayKey],
  )
  const activeCategoryGroups = useMemo(
    () => getSelectableCategoryGroups(settings.customSubcategories),
    [settings.customSubcategories],
  )
  const summary = useMemo(
    () => summarizePortfolio(assets.filter((asset) => asset.kind !== 'service'), settings, todayKey),
    [assets, settings, todayKey],
  )
  const serviceSummary = useMemo(
    () => summarizeServices(assets, todayKey),
    [assets, todayKey],
  )
  const visibleAssets = useMemo(() => {
    const filtered = filterAssets(assets.filter((asset) => asset.kind !== 'service'), search, category)
    const computed = filtered.map((asset) => computeAsset(asset, settings, todayKey))

    return sortComputedAssets(computed, sortKey)
  }, [assets, category, search, settings, sortKey, todayKey])
  const visibleServices = useMemo(
    () => filterAndSortServices(computedServices, search, serviceCategoryFilter, serviceSortKey),
    [computedServices, search, serviceCategoryFilter, serviceSortKey],
  )
  const selectedAsset = useMemo(
    () => computedAssets.find((asset) => asset.id === selectedId) ?? null,
    [computedAssets, selectedId],
  )
  const selectedService = useMemo(
    () => computedServices.find((service) => service.id === selectedId) ?? null,
    [computedServices, selectedId],
  )

  const showAppToast = useCallback((message: string, duration = 2600) => {
    setAppToast(message)
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => {
      setAppToast('')
      toastTimerRef.current = null
    }, duration)
  }, [])

  useEffect(() => {
    const handleExportResult = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail
      showAppToast(detail?.message || '导出完成')
    }

    window.addEventListener('zhiwu:export-result', handleExportResult)
    return () => {
      window.removeEventListener('zhiwu:export-result', handleExportResult)
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    }
  }, [showAppToast])

  function requestAppDialog(dialog: AppDialogState) {
    dialogResolverRef.current?.(false)
    setAppDialog(dialog)
    return new Promise<boolean>((resolve) => {
      dialogResolverRef.current = resolve
    })
  }

  const settleAppDialog = useCallback((confirmed: boolean) => {
    const resolve = dialogResolverRef.current
    dialogResolverRef.current = null
    setAppDialog(null)
    resolve?.(confirmed)
  }, [])

  async function updateSettings(nextSettings: Settings) {
    try {
      await saveSettings(nextSettings)
      setSettings(nextSettings)
      return true
    } catch {
      await requestAppDialog({ title: '设置未保存', message: '请检查设备存储空间后重试。', confirmLabel: '知道了' })
      return false
    }
  }

  async function handleAddCustomSubcategory(category: Category, name: string, previousName?: string) {
    const cleanName = name.trim()

    if (!cleanName) return null

    const builtIn = getSubcategoryMeta(cleanName, [], category)
    if (builtIn.iconKey && builtIn.category !== category) return null

    const activeGroup = getCategoryGroups(settings.customSubcategories).find((group) => group.name === category)
    const existing = activeGroup?.items.find((item) => item.name !== previousName && (
      item.name === cleanName || getSubcategoryDisplayName(category, item.name, settings.customSubcategories) === cleanName
    ))

    if (existing && cleanName !== previousName) return null
    const previous = settings.customSubcategories.find((item) => item.category === category && item.name === previousName)
    if (previousName !== undefined && !previous) return null
    if (previousName !== undefined && getSubcategoryMeta(previousName, [], category).iconKey) return null

    const nextItem: CustomSubcategory = {
      category,
      name: cleanName,
      emoji: previous?.emoji ?? '📦',
      ...(previous?.iconKey ? { iconKey: previous.iconKey } : {}),
    }
    const nextSettings = {
      ...settings,
      customSubcategories: previous
        ? settings.customSubcategories.map((item) => item === previous ? nextItem : item)
        : [...settings.customSubcategories, nextItem],
    }

    if (previous) {
      try {
        await updateCustomSubcategory({ category, name: previous.name }, nextItem, nextSettings)
        setSettings(nextSettings)
        setAssets((current) => current.map((asset) => asset.kind !== 'service'
          && asset.category === category && asset.subcategory === previous.name
          ? { ...asset, subcategory: nextItem.name } : asset))
        return nextItem.name
      } catch {
        return null
      }
    }
    return await updateSettings(nextSettings) ? nextItem.name : null
  }

  function openCreateForm(
    kind: RecordKind = activeTab === 'home' ? homeMode : activeTab === 'assets' ? recordsMode : 'item',
  ) {
    setEditingId(null)
    setFormValues({
      ...emptyForm,
      kind,
      purchaseDate: kind === 'item' ? toLocalDateKey() : '',
      nextEventDate: '',
    })
    setFormError('')
  }

  function openEditForm(asset: Asset) {
    // Computed services expose a projected renewal date; editing must use the
    // original record so opening the form cannot silently change its schedule.
    asset = assets.find((stored) => stored.id === asset.id) ?? asset

    setEditingId(asset.id)
    setFormValues({
      kind: asset.kind === 'service' ? 'service' : 'item',
      name: asset.name,
      category: asset.category,
      subcategory: asset.subcategory,
      valueTrackingEnabled: asset.valueTrackingEnabled,
      purchasePriceCny: String(asset.purchasePriceCny),
      purchaseDate: asset.purchaseDate,
      photoDataUrl: asset.photoDataUrl,
      note: asset.note,
      serviceCategory: asset.serviceCategory ?? '其他',
      billingMode: asset.billingMode ?? 'subscription',
      serviceAmountCny: String(asset.serviceAmountCny ?? 0),
      billingCycle: asset.billingCycle ?? 'monthly',
      nextEventDate: asset.nextEventDate ?? '',
      autoRenew: asset.autoRenew !== false,
      reminderDays: String(asset.reminderDays ?? 3),
      planName: asset.planName ?? '',
      usageTags: asset.usageTags ?? [],
      showMoreServiceFields: Boolean(asset.purchaseDate || asset.planName || asset.usageTags?.length || asset.note),
    })
    setFormError('')
  }

  const closeForm = useCallback(() => {
    if (closingLayer) return

    setClosingLayer('form')
    window.setTimeout(() => {
      setEditingId(null)
      setFormValues(emptyForm)
      setFormError('')
      setClosingLayer(null)
    }, 190)
  }, [closingLayer])

  const closeDetail = useCallback(() => {
    if (closingLayer) return

    setClosingLayer('detail')
    window.setTimeout(() => {
      setSelectedId(null)
      setClosingLayer(null)
    }, 190)
  }, [closingLayer])

  function resetFormImmediately() {
    setEditingId(null)
    setFormValues(emptyForm)
    setFormError('')
  }

  async function handleSaveAsset() {
    const name = formValues.name.trim()

    if (!name) {
      setFormError('名称不能为空')
      return
    }

    if (formValues.kind === 'service') {
      const amountText = formValues.serviceAmountCny.trim()
      const isFreeService = formValues.billingMode === 'free'
      const serviceAmountCny = isFreeService ? 0 : amountText ? Number(amountText) : 0
      const existingService = assets.find((asset) => asset.id === editingId)
      const unchangedLegacyZero = ['subscription', 'fixed', 'credit', 'usage'].includes(formValues.billingMode)
        && existingService?.billingMode === formValues.billingMode
        && existingService.serviceAmountCny === 0
        && serviceAmountCny === 0

      if (!isFreeService && !amountText) {
        setFormError(
          formValues.billingMode === 'one-time'
            ? '请填写已付金额'
            : '请填写服务费用',
        )
        return
      }

      if (!isFreeService && (!Number.isFinite(serviceAmountCny) || (serviceAmountCny <= 0 && !unchangedLegacyZero))) {
        setFormError('服务费用必须大于 0')
        return
      }

      if (formValues.purchaseDate && isFutureLocalDate(formValues.purchaseDate, todayKey)) {
        setFormError('开始日期不能晚于今天')
        return
      }

      if (formValues.purchaseDate && formValues.nextEventDate && formValues.purchaseDate > formValues.nextEventDate) {
        setFormError('开始日期不能晚于到期日')
        return
      }

      if (formValues.billingMode === 'one-time' && !formValues.purchaseDate) {
        setFormError('一次购买需要填写购买日期')
        return
      }

      const now = new Date().toISOString()
      const existing = assets.find((asset) => asset.id === editingId)
      const nextService: Asset = {
        id: existing?.id ?? crypto.randomUUID(),
        name,
        kind: 'service',
        category: '其他',
        subcategory: '待分类',
        valueTrackingEnabled: false,
        purchasePriceCny: 0,
        purchaseDate: formValues.purchaseDate,
        photoDataUrl: '',
        note: formValues.note.trim(),
        serviceCategory: formValues.serviceCategory,
        billingMode: formValues.billingMode,
        serviceAmountCny,
        billingCycle: formValues.billingCycle,
        nextEventDate: formValues.nextEventDate,
        autoRenew: isRecurringBillingMode(formValues.billingMode) ? formValues.autoRenew : false,
        reminderDays: Math.max(0, Number(formValues.reminderDays) || 0),
        planName: formValues.planName.trim(),
        usageTags: formValues.serviceCategory === 'AI服务' ? formValues.usageTags : [],
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }

      try {
        await saveAsset(nextService)
      } catch {
        setFormError('保存失败，请检查设备存储空间后重试。')
        return
      }
      setAssets((current) => [nextService, ...current.filter((asset) => asset.id !== nextService.id)])
      setSelectedId(null)
      setHomeMode('service')
      setActiveTab('home')
      resetFormImmediately()
      showAppToast(existing ? '已保存' : '已添加', 1700)
      return
    }

    const purchasePriceCny = Number(formValues.purchasePriceCny)
    const purchaseDate = formValues.purchaseDate

    if (purchaseDate && isFutureLocalDate(purchaseDate, todayKey)) {
      setFormError('开始日期不能晚于今天')
      return
    }

    if (formValues.valueTrackingEnabled) {
      if (!Number.isFinite(purchasePriceCny) || purchasePriceCny <= 0) {
        setFormError('购入金额必须大于 0')
        return
      }

      if (!purchaseDate) {
        setFormError('开启计算时需要填写开始日期')
        return
      }
    }

    const now = new Date().toISOString()
    const existing = assets.find((asset) => asset.id === editingId)
    const preservedPurchasePrice = Number.isFinite(purchasePriceCny) && purchasePriceCny >= 0
      ? purchasePriceCny
      : existing?.purchasePriceCny ?? 0
    const nextAsset: Asset = {
      id: existing?.id ?? crypto.randomUUID(),
      name,
      kind: 'item',
      category: formValues.category,
      subcategory: formValues.subcategory,
      valueTrackingEnabled: formValues.valueTrackingEnabled,
      purchasePriceCny: preservedPurchasePrice,
      purchaseDate,
      photoDataUrl: existing?.photoDataUrl ?? '',
      note: formValues.note.trim(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }

    try {
      await saveAsset(nextAsset)
    } catch {
      setFormError('保存失败，请检查设备存储空间后重试。')
      return
    }
    setAssets((current) => {
      const withoutExisting = current.filter((asset) => asset.id !== nextAsset.id)
      return [nextAsset, ...withoutExisting]
    })
    setSelectedId(null)
    setHomeMode('item')
    setActiveTab('home')
    resetFormImmediately()
    showAppToast(existing ? '已保存' : '已添加', 1700)
  }

  async function handleDeleteAsset(assetId: string) {
    const confirmed = await requestAppDialog({
      title: '确认删除？',
      message: '删除后无法恢复，这条记录会从所有页面中移除。',
      confirmLabel: '删除',
      cancelLabel: '取消',
      danger: true,
    })
    if (!confirmed) return

    try {
      await deleteAsset(assetId)
    } catch {
      await requestAppDialog({ title: '删除失败', message: '记录未能删除，请重试。', confirmLabel: '知道了' })
      return
    }
    setAssets((current) => current.filter((asset) => asset.id !== assetId))
    setSelectedId(null)
  }

  async function exportFile(filename: string, text: string, type: string, label: string) {
    try {
      const result = await downloadTextFile(filename, text, type)
      showAppToast(result === 'saved' ? `${label}已保存` : result === 'cancelled' ? '已取消导出' : `正在导出 ${label}`)
    } catch {
      await requestAppDialog({ title: '导出失败', message: '文件未能保存，请检查可用存储空间后重试。', confirmLabel: '知道了' })
    }
  }

  function handleJsonExport() {
    const backup = createBackup(assets, settings)
    void exportFile(
      `知物备份-${toLocalDateKey()}.json`,
      JSON.stringify(backup, null, 2),
      'application/json;charset=utf-8',
      'JSON 备份',
    )
  }

  function handleCsvExport() {
    void exportFile(`知物清单-${toLocalDateKey()}.csv`, buildCsv(assets), 'text/csv;charset=utf-8', 'CSV 清单')
  }

  async function handleImport(file: File | undefined) {
    if (!file) return

    try {
      let raw: unknown
      try {
        raw = JSON.parse(await file.text())
      } catch {
        throw new Error('无法读取 JSON 备份文件，请确认选择的是完整的知物备份。')
      }
      const parsed = parseBackup(raw)
      const itemCount = parsed.assets.filter((asset) => asset.kind !== 'service').length
      const serviceCount = parsed.assets.length - itemCount

      const confirmed = await requestAppDialog({
        title: '替换当前数据？',
        message: `备份包含 ${itemCount} 条物品、${serviceCount} 条服务。导入将覆盖当前 ${assets.length} 条记录和设置，建议先导出当前数据的 JSON 备份。`,
        confirmLabel: '继续导入',
        cancelLabel: '取消',
        danger: true,
      })
      if (!confirmed) return

      await replaceAllData(parsed.assets, parsed.settings)
      setAssets(parsed.assets)
      setSettings(parsed.settings)
      setSelectedId(null)

      showAppToast('备份导入成功')
    } catch (error) {
      await requestAppDialog({
        title: '导入失败',
        message: error instanceof Error ? error.message : '无法读取这份备份文件。',
        confirmLabel: '知道了',
      })
    } finally {
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  async function handleClearDemo() {
    const confirmed = await requestAppDialog({
      title: '清空示例数据？',
      message: '只会移除应用自带的示例（包括修改过的示例），不会删除你自己添加的记录。',
      confirmLabel: '清空示例',
      cancelLabel: '取消',
      danger: true,
    })
    if (!confirmed) return

    let nextAssets: Asset[]
    try {
      nextAssets = await clearDemoAssets()
    } catch {
      await requestAppDialog({ title: '清理失败', message: '示例未能清理，请重试。', confirmLabel: '知道了' })
      return
    }
    setAssets(nextAssets)
    setSelectedId(null)
    showAppToast('示例数据已清空')
  }

  async function handleWelcomeChoice(withDemo: boolean) {
    if (starting) return
    setStarting(true)
    try {
      const result = await initializeFreshData(withDemo ? createDemoAssets() : [])
      setAssets(result.assets)
      setSettings(result.settings)
      setShowWelcome(false)
      if (!withDemo && result.initialized) openCreateForm('item')
    } catch {
      await requestAppDialog({ title: '无法保存设置', message: '请检查设备存储空间后重试。你的数据没有被清空。', confirmLabel: '知道了' })
    } finally {
      setStarting(false)
    }
  }

  const formOpen = editingId !== null || formValues !== emptyForm
  const topbarMode = activeTab === 'home' ? homeMode : activeTab === 'assets' ? recordsMode : 'item'

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return
    const listener = CapacitorApp.addListener('backButton', () => {
      if (closingLayer) return
      if (appDialog) {
        settleAppDialog(false)
        return
      }
      if (document.querySelector('.date-picker-dialog')) {
        window.dispatchEvent(new Event('zhiwu:close-date-picker'))
        return
      }
      if (formOpen) {
        closeForm()
        return
      }
      if (selectedAsset || selectedService) {
        closeDetail()
        return
      }
      if (activeTab !== 'home') {
        setActiveTab('home')
        return
      }

      CapacitorApp.exitApp()
    })

    return () => {
      listener.then((handle) => handle.remove()).catch(() => undefined)
    }
  }, [activeTab, appDialog, closeDetail, closeForm, closingLayer, formOpen, selectedAsset, selectedService, settleAppDialog])

  if (storageUnavailable && !isLoading) {
    return (
      <main className="startup-error" role="alert">
        <h1>无法读取本地数据</h1>
        <p>请关闭应用后重试。为避免数据丢失，请勿清除应用数据或卸载应用。</p>
        <button type="button" onClick={() => window.location.reload()}>重新尝试</button>
      </main>
    )
  }

  return (
    <div className="app-frame">
      <div className={isLoading ? 'app-shell splash-shell' : 'app-shell'}>
        {!isLoading && (
          <header className="topbar">
            <div className={activeTab === 'settings' ? 'topbar-brand settings-brand' : 'topbar-brand'}>
              <h1>{activeTab === 'settings' ? '设置' : '知物'}</h1>
              {activeTab !== 'settings' && (
                <p>{topbarMode === 'service' ? '服务的费用与期限' : '物品的时间与价值'}</p>
              )}
            </div>
            {activeTab !== 'settings' && (
              <button
                className="icon-button add-button"
                type="button"
                onClick={() => openCreateForm(topbarMode)}
                title={topbarMode === 'service' ? '新增服务' : '新增物品'}
              >
                <Plus size={18} />
              </button>
            )}
          </header>
        )}
        {!isLoading && assets.some((asset) => asset.id.startsWith('demo-')) && (
          <div className="demo-notice" role="status">
            <span>含示例数据，已计入统计</span>
            <button type="button" onClick={handleClearDemo}>清空示例</button>
          </div>
        )}

        <main
          className={
            isLoading
              ? 'screen splash-screen'
              : activeTab === 'home'
                ? 'screen home-screen'
                : activeTab === 'settings'
                  ? 'screen settings-screen'
                  : 'screen'
          }
        >
          {isLoading ? (
            <div className="loading-state">
              <strong>知物</strong>
              <span>物品的时间与价值</span>
            </div>
          ) : (
            <>
              <div
                className="home-view-host"
                hidden={activeTab !== 'home'}
                inert={activeTab !== 'home'}
                aria-hidden={activeTab !== 'home'}
              >
                <HomeView
                  isActive={activeTab === 'home'}
                  mode={homeMode}
                  onModeChange={setHomeMode}
                  summary={summary}
                  serviceSummary={serviceSummary}
                  assets={computedAssets}
                  services={computedServices}
                  customSubcategories={settings.customSubcategories}
                  onOpenAsset={setSelectedId}
                  onCreate={openCreateForm}
                />
              </div>
              {activeTab === 'assets' && (
                <RecordsView
                  mode={recordsMode}
                  onModeChange={setRecordsMode}
                  assets={visibleAssets}
                  services={visibleServices}
                  assetCount={computedAssets.length}
                  serviceCount={computedServices.length}
                  customSubcategories={settings.customSubcategories}
                  search={search}
                  category={category}
                  serviceCategory={serviceCategoryFilter}
                  sortKey={sortKey}
                  serviceSortKey={serviceSortKey}
                  onSearch={setSearch}
                  onCategory={setCategory}
                  onServiceCategory={setServiceCategoryFilter}
                  onSort={setSortKey}
                  onServiceSort={setServiceSortKey}
                  onOpenAsset={setSelectedId}
                  onCreate={openCreateForm}
                />
              )}
              {activeTab === 'settings' && (
                <SettingsView
                  settings={settings}
                  onThemeChange={(theme) => updateSettings({ ...settings, theme })}
                  onJsonExport={handleJsonExport}
                  onCsvExport={handleCsvExport}
                  onImportClick={() => importInputRef.current?.click()}
                  onClearDemo={handleClearDemo}
                  hasDemoAssets={assets.some((asset) => asset.id.startsWith('demo-'))}
                />
              )}
            </>
          )}
        </main>

        {!isLoading && (
          <nav className="bottom-nav" aria-label="主导航">
            <NavButton active={activeTab === 'home'} label="总览" icon={<MdiIcon path={mdiHomeVariant} className="nav-glyph" />} onClick={() => setActiveTab('home')} />
            <NavButton active={activeTab === 'assets'} label="清单" icon={<MdiIcon path={mdiArchive} className="nav-glyph" />} onClick={() => setActiveTab('assets')} />
            <NavButton active={activeTab === 'settings'} label="设置" icon={<MdiIcon path={mdiCog} className="nav-glyph" />} onClick={() => setActiveTab('settings')} />
          </nav>
        )}
      </div>

      <input
        ref={importInputRef}
        className="visually-hidden"
        type="file"
        accept="application/json"
        onChange={(event) => handleImport(event.target.files?.[0])}
      />

      {showWelcome && !isLoading && (
        <div className="app-dialog-backdrop">
          <section className="app-dialog welcome-dialog" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
            <div className="app-dialog-copy">
              <h2 id="welcome-title">欢迎使用知物</h2>
              <p>记录物品陪伴的时间，管理服务的期限。数据保存在当前设备，请定期备份。</p>
            </div>
            <div className="app-dialog-actions">
              <button type="button" disabled={starting} onClick={() => void handleWelcomeChoice(true)}>看看示例</button>
              <button className="primary" type="button" disabled={starting} onClick={() => void handleWelcomeChoice(false)}>开始记录</button>
            </div>
          </section>
        </div>
      )}

      {formOpen && (
        <AssetForm
          values={formValues}
          todayKey={todayKey}
          error={formError}
          isEditing={editingId !== null}
          categoryGroups={activeCategoryGroups}
          customSubcategories={settings.customSubcategories}
          onChange={setFormValues}
          onClose={closeForm}
          onSave={handleSaveAsset}
          onAddCustomSubcategory={handleAddCustomSubcategory}
          isClosing={closingLayer === 'form'}
        />
      )}

      {selectedAsset && !formOpen && (
        <AssetDetail
          asset={selectedAsset}
          customSubcategories={settings.customSubcategories}
          onClose={closeDetail}
          onEdit={() => openEditForm(selectedAsset)}
          onDelete={() => handleDeleteAsset(selectedAsset.id)}
          isClosing={closingLayer === 'detail'}
        />
      )}

      {selectedService && !formOpen && (
        <ServiceDetail
          service={selectedService}
          onClose={closeDetail}
          onEdit={() => openEditForm(selectedService)}
          onDelete={() => handleDeleteAsset(selectedService.id)}
          isClosing={closingLayer === 'detail'}
        />
      )}

      {appDialog && (
        <ThemedDialog dialog={appDialog} onResult={settleAppDialog} />
      )}
      {appToast && <AppToast message={appToast} />}
    </div>
  )
}

function HomeView({
  isActive,
  mode,
  onModeChange,
  summary,
  serviceSummary,
  assets,
  services,
  customSubcategories,
  onOpenAsset,
  onCreate,
}: {
  isActive: boolean
  mode: RecordKind
  onModeChange: (mode: RecordKind) => void
  summary: ReturnType<typeof summarizePortfolio>
  serviceSummary: ReturnType<typeof summarizeServices>
  assets: ComputedAsset[]
  services: ComputedService[]
  customSubcategories: CustomSubcategory[]
  onOpenAsset: (id: string) => void
  onCreate: (kind: RecordKind) => void
}) {
  const [durationUnit, setDurationUnit] = useState<'days' | 'years'>('days')
  const timelineAssets = [...assets].sort((a, b) => {
    const aDays = a.daysHeld ?? Number.MAX_SAFE_INTEGER
    const bDays = b.daysHeld ?? Number.MAX_SAFE_INTEGER

    return aDays - bDays
  })
  const longestHeldAsset = assets.reduce<ComputedAsset | null>((longest, asset) => {
    if (asset.daysHeld === null) return longest
    return longest === null || asset.daysHeld > (longest.daysHeld ?? -1) ? asset : longest
  }, null)
  const insightAsset = summary.leastValue ?? summary.bestValue
  const totalValueText = formatCny(summary.totalPurchase).replace(/\.00$/, '')
  const recentYearValueText = formatCny(summary.recentYearPurchase).replace(/\.00$/, '')
  const timelineServices = sortServicesByEvent(services)
  const serviceDailyScale = serviceSummary.dailySpend >= 10000 ? 'dense' : serviceSummary.dailySpend >= 1000 ? 'compact' : ''
  const serviceDailyText = formatDailyCny(serviceSummary.dailySpend).replace('/天', '')
  const monthlySpendText = formatCny(serviceSummary.monthlySpend).replace(/\.00$/, '')
  const annualSpendText = formatCny(serviceSummary.annualEstimate).replace(/\.00$/, '')
  const nextService = serviceSummary.nextService
  const homeModeCarouselRef = useRef<HTMLDivElement>(null)
  const homeModeScrollFrameRef = useRef<number | null>(null)
  const requestedHomeModeRef = useRef<RecordKind | null>(null)
  const modeChangedByScrollRef = useRef(false)
  const homeModeHasAlignedRef = useRef(false)
  const homeModeWasActiveRef = useRef(false)

  useLayoutEffect(() => {
    const becameActive = isActive && !homeModeWasActiveRef.current
    homeModeWasActiveRef.current = isActive

    if (!isActive) return

    const carousel = homeModeCarouselRef.current
    if (!carousel) return

    const targetLeft = mode === 'service' ? carousel.clientWidth : 0
    const isInitialAlignment = !homeModeHasAlignedRef.current
    homeModeHasAlignedRef.current = true

    if (isInitialAlignment || becameActive) {
      modeChangedByScrollRef.current = false
      requestedHomeModeRef.current = null
      jumpHorizontally(carousel, targetLeft)
      return
    }

    if (modeChangedByScrollRef.current) {
      modeChangedByScrollRef.current = false
      return
    }

    if (Math.abs(carousel.scrollLeft - targetLeft) < 1) return

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    scrollHorizontally(carousel, targetLeft, reduceMotion ? 'auto' : 'smooth')
  }, [isActive, mode])

  useEffect(() => {
    if (!isActive) return

    function alignActiveMode() {
      const carousel = homeModeCarouselRef.current
      if (!carousel) return
      jumpHorizontally(carousel, mode === 'service' ? carousel.clientWidth : 0)
    }

    window.addEventListener('resize', alignActiveMode)
    return () => window.removeEventListener('resize', alignActiveMode)
  }, [isActive, mode])

  useEffect(() => () => {
    if (homeModeScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(homeModeScrollFrameRef.current)
    }
  }, [])

  function handleHomeModeScroll() {
    if (homeModeScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(homeModeScrollFrameRef.current)
    }

    homeModeScrollFrameRef.current = window.requestAnimationFrame(() => {
      const carousel = homeModeCarouselRef.current
      if (!carousel?.clientWidth) return

      const requestedMode = requestedHomeModeRef.current
      if (requestedMode) {
        const requestedLeft = requestedMode === 'service' ? carousel.clientWidth : 0
        if (Math.abs(carousel.scrollLeft - requestedLeft) < 1) {
          requestedHomeModeRef.current = null
        }
        return
      }

      const nextMode: RecordKind = carousel.scrollLeft >= carousel.clientWidth / 2 ? 'service' : 'item'
      if (nextMode !== mode) {
        modeChangedByScrollRef.current = true
        onModeChange(nextMode)
      }
    })
  }

  function selectHomeMode(nextMode: RecordKind) {
    modeChangedByScrollRef.current = false
    requestedHomeModeRef.current = nextMode
    onModeChange(nextMode)
  }

  return (
    <section className="home-layout">
      <div className="home-fixed-region home-tabs-region">
        <div className="home-mode-tabs" role="tablist" aria-label="记录类型">
          <button
            id="home-mode-item-tab"
            className={mode === 'item' ? 'active' : ''}
            type="button"
            role="tab"
            aria-selected={mode === 'item'}
            aria-controls="home-mode-item-page"
            onClick={() => selectHomeMode('item')}
          >
            物品 <span>{summary.assetCount}</span>
          </button>
          <button
            id="home-mode-service-tab"
            className={mode === 'service' ? 'active' : ''}
            type="button"
            role="tab"
            aria-selected={mode === 'service'}
            aria-controls="home-mode-service-page"
            onClick={() => selectHomeMode('service')}
          >
            服务 <span>{serviceSummary.serviceCount}</span>
          </button>
        </div>
      </div>

      <div
        ref={homeModeCarouselRef}
        className="home-mode-carousel"
        onScroll={handleHomeModeScroll}
        onPointerDown={() => {
          requestedHomeModeRef.current = null
        }}
      >
        <section
          id="home-mode-item-page"
          className="home-mode-page"
          role="tabpanel"
          aria-labelledby="home-mode-item-tab"
          aria-hidden={mode !== 'item'}
          inert={mode !== 'item'}
        >
          <div className="home-fixed-region home-mode-summary">
            <div className="overview-panel">
              <div className="overview-main">
                <span>陪伴最久</span>
                {longestHeldAsset ? (
                  <>
                    <strong>
                      <span>{longestHeldAsset.daysHeld?.toLocaleString('zh-CN')}</span>
                      <small>天</small>
                    </strong>
                    <p className="overview-item-name user-copyable" title={longestHeldAsset.name}>{longestHeldAsset.name}</p>
                  </>
                ) : <p className="overview-item-empty">记录拥有日期，开启时间线</p>}
              </div>
              <div className="overview-meta">
                <span>
                  <small>累计投入</small>
                  <strong className="portfolio-value">{totalValueText}</strong>
                </span>
                <span>
                  <small>近一年投入</small>
                  <strong className="portfolio-value">{recentYearValueText}</strong>
                </span>
              </div>
            </div>

            {insightAsset && (
              <button className="time-insight" type="button" onClick={() => onOpenAsset(insightAsset.id)}>
                <span className="time-insight-icon" aria-hidden="true">
                  <InsightBulbIcon />
                </span>
                <span className="time-insight-copy">
                  <strong>{insightAsset.name}</strong>
                  <small>当前日均持有成本最高。</small>
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            )}
            {!insightAsset && <div className="time-insight-placeholder" aria-hidden="true" />}

            <div className="timeline-heading">
              <h2>拥有时长</h2>
              <span>日均成本</span>
            </div>
          </div>

          <div className="timeline-scroll" aria-label="按持有时间排列的物品">
            {timelineAssets.length ? (
              <div className="timeline-list">
                {timelineAssets.map((asset, index) => (
                  <TimelineRow
                    key={asset.id}
                    asset={asset}
                    index={index}
                    durationUnit={durationUnit}
                    customSubcategories={customSubcategories}
                    onToggleDuration={() => setDurationUnit((current) => current === 'days' ? 'years' : 'days')}
                    onOpen={onOpenAsset}
                  />
                ))}
              </div>
            ) : <EmptyState kind="item" onCreate={() => onCreate('item')} />}
          </div>
        </section>

        <section
          id="home-mode-service-page"
          className="home-mode-page"
          role="tabpanel"
          aria-labelledby="home-mode-service-tab"
          aria-hidden={mode !== 'service'}
          inert={mode !== 'service'}
        >
          <div className="home-fixed-region home-mode-summary">
            <div className="overview-panel service-overview">
              <div className="overview-main">
                <span>日均服务成本</span>
                <strong className={serviceDailyScale}>
                  <span>{serviceDailyText}</span>
                  <small>/天</small>
                </strong>
              </div>
              <div className="overview-meta">
                <span>
                  <small>折合月均</small>
                  <strong className="portfolio-value">{monthlySpendText}</strong>
                </span>
                <span>
                  <small>折合年均</small>
                  <strong className="portfolio-value">{annualSpendText}</strong>
                </span>
              </div>
            </div>

            {nextService && (
              <button className="time-insight" type="button" onClick={() => onOpenAsset(nextService.id)}>
                <span className="time-insight-icon" aria-hidden="true">
                  <InsightBulbIcon />
                </span>
                <span className="time-insight-copy">
                  <strong>{nextService.name}</strong>
                  <small>
                    {nextService.effectiveNextEventDate
                      ? `${formatServiceCountdown(nextService.eventDays)}${getServiceEventNoun(nextService.billingMode)}；${getServiceEventDescription(nextService)}。`
                      : nextService.billingMode === 'one-time' || nextService.billingMode === 'free'
                        ? '长期有效，日均成本会随使用时间更新。'
                        : '尚未填写下次日期，可在详情中补充。'}
                  </small>
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            )}
            {!nextService && <div className="time-insight-placeholder" aria-hidden="true" />}

            <div className="timeline-heading">
              <h2>续费日程</h2>
              <span>日均成本</span>
            </div>
          </div>

          <div className="timeline-scroll" aria-label="按关键日期排列的服务">
            {timelineServices.length ? (
            <div className="timeline-list">
              {timelineServices.map((service, index) => (
                <ServiceTimelineRow key={service.id} service={service} index={index} onOpen={onOpenAsset} />
              ))}
            </div>
            ) : <EmptyState kind="service" onCreate={() => onCreate('service')} />}
          </div>
        </section>
      </div>
    </section>
  )
}

function RecordsView({
  mode,
  onModeChange,
  assets,
  services,
  assetCount,
  serviceCount,
  customSubcategories,
  search,
  category,
  serviceCategory,
  sortKey,
  serviceSortKey,
  onSearch,
  onCategory,
  onServiceCategory,
  onSort,
  onServiceSort,
  onOpenAsset,
  onCreate,
}: {
  mode: RecordKind
  onModeChange: (mode: RecordKind) => void
  assets: ComputedAsset[]
  services: ComputedService[]
  assetCount: number
  serviceCount: number
  customSubcategories: CustomSubcategory[]
  search: string
  category: string
  serviceCategory: string
  sortKey: SortKey
  serviceSortKey: ServiceSortKey
  onSearch: (value: string) => void
  onCategory: (value: string) => void
  onServiceCategory: (value: string) => void
  onSort: (value: SortKey) => void
  onServiceSort: (value: ServiceSortKey) => void
  onOpenAsset: (id: string) => void
  onCreate: (kind: RecordKind) => void
}) {
  const isService = mode === 'service'

  return (
    <section className="stack records-stack">
      <div className="records-mode-tabs" role="tablist" aria-label="清单类型">
        <button
          className={!isService ? 'active' : ''}
          type="button"
          role="tab"
          aria-selected={!isService}
          onClick={() => onModeChange('item')}
        >
          物品 <span>{assetCount}</span>
        </button>
        <button
          className={isService ? 'active' : ''}
          type="button"
          role="tab"
          aria-selected={isService}
          onClick={() => onModeChange('service')}
        >
          服务 <span>{serviceCount}</span>
        </button>
      </div>

      <div className="search-row">
        <Search size={18} />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={isService ? '搜索服务、套餐或备注' : '搜索名称或备注'}
        />
      </div>

      <div className="chip-row" aria-label="分类筛选">
        {(isService ? ['全部', ...serviceCategories] : ['全部', ...mvpCategories]).map((item) => (
          <button
            key={item}
            className={item === (isService ? serviceCategory : category) ? 'chip active' : 'chip'}
            type="button"
            onClick={() => isService ? onServiceCategory(item) : onCategory(item)}
          >
            {isService ? item : getCategoryDisplayName(item)}
          </button>
        ))}
      </div>

      {isService ? (
        <SortControl key="service" value={serviceSortKey} options={serviceSortOptions} onChange={onServiceSort} />
      ) : (
        <SortControl key="item" value={sortKey} options={itemSortOptions} onChange={onSort} />
      )}

      {!isService && assets.length ? (
        <div className="asset-list">
          {assets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              customSubcategories={customSubcategories}
              onOpen={onOpenAsset}
            />
          ))}
        </div>
      ) : null}

      {isService && services.length ? (
        <div className="asset-list">
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} onOpen={onOpenAsset} />
          ))}
        </div>
      ) : null}

      {!isService && !assets.length && <EmptyState kind="item" onCreate={() => onCreate('item')} />}
      {isService && !services.length && <EmptyState kind="service" onCreate={() => onCreate('service')} />}
    </section>
  )
}

function SortControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: SortOption<T>[]
  onChange: (value: T) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const controlRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const activeLabel = options.find((option) => option.value === value)?.label ?? options[0]?.label

  useEffect(() => {
    if (!isOpen) return

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!controlRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOnOutsidePress)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen])

  return (
    <div className="sort-control" ref={controlRef}>
      <button
        ref={triggerRef}
        className="select-row sort-trigger"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <SlidersHorizontal size={18} />
        <span>{activeLabel}</span>
        <ChevronDown className={isOpen ? 'rotated' : ''} size={17} />
      </button>
      <div
        className={isOpen ? 'sort-options is-open' : 'sort-options'}
        role="listbox"
        aria-label="排序方式"
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        {options.map((option) => (
          <button
            key={option.value}
            className={option.value === value ? 'active' : ''}
            type="button"
            role="option"
            aria-selected={option.value === value}
            onClick={() => {
              onChange(option.value)
              setIsOpen(false)
            }}
          >
            <span>{option.label}</span>
            {option.value === value && <Check size={16} />}
          </button>
        ))}
      </div>
    </div>
  )
}

function SettingsView({
  settings,
  onThemeChange,
  onJsonExport,
  onCsvExport,
  onImportClick,
  onClearDemo,
  hasDemoAssets,
}: {
  settings: Settings
  onThemeChange: (theme: Settings['theme']) => void
  onJsonExport: () => void
  onCsvExport: () => void
  onImportClick: () => void
  onClearDemo: () => void
  hasDemoAssets: boolean
}) {
  return (
    <section className="stack settings-stack">
      <div className="settings-group">
        <div className="settings-group-heading">
          <h2>外观</h2>
          <span>界面主题</span>
        </div>
        <div className="segmented">
          {(['system', 'light', 'dark'] as const).map((theme) => (
            <button
              key={theme}
              className={settings.theme === theme ? 'active' : ''}
              type="button"
              onClick={() => onThemeChange(theme)}
            >
              {theme === 'system' ? '跟随系统' : theme === 'light' ? '浅色' : '深色'}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group-heading">
          <h2>数据</h2>
          <span>备份、迁移与清理</span>
        </div>
        <div className="action-grid">
          <button type="button" onClick={onJsonExport}>
            <Download size={18} />
            JSON 备份
          </button>
          <button type="button" onClick={onCsvExport}>
            <Download size={18} />
            CSV 清单
          </button>
          <button type="button" onClick={onImportClick}>
            <Upload size={18} />
            导入备份
          </button>
          <button type="button" onClick={onClearDemo} disabled={!hasDemoAssets}>
            <Trash2 size={18} />
            清空示例
          </button>
        </div>
      </div>
      <AboutSettings />
    </section>
  )
}

function AssetForm({
  values,
  todayKey,
  error,
  isEditing,
  isClosing,
  categoryGroups,
  customSubcategories,
  onChange,
  onClose,
  onSave,
  onAddCustomSubcategory,
}: {
  values: AssetFormValues
  todayKey: string
  error: string
  isEditing: boolean
  isClosing: boolean
  categoryGroups: ReturnType<typeof getCategoryGroups>
  customSubcategories: CustomSubcategory[]
  onChange: (values: AssetFormValues) => void
  onClose: () => void
  onSave: () => void
  onAddCustomSubcategory: (category: Category, name: string, previousName?: string) => Promise<Subcategory | null>
}) {
  const recordLabel = values.kind === 'service' ? '服务' : '物品'

  return (
    <div
      className={isClosing ? 'sheet-backdrop closing' : 'sheet-backdrop'}
      role="dialog"
      aria-modal="true"
      aria-label={`${isEditing ? '编辑' : '新增'}${recordLabel}`}
    >
      <div className="sheet form-sheet">
        <div className="sheet-header">
          <h2>{isEditing ? '编辑' : '新增'}{recordLabel}</h2>
          <div className="sheet-header-actions">
            {!isEditing && (
              <button
                className="record-type-switch"
                type="button"
                onClick={() => {
                  const nextKind = values.kind === 'service' ? 'item' : 'service'
                  onChange({
                    ...values,
                    kind: nextKind,
                    purchaseDate: nextKind === 'item' ? (values.purchaseDate || todayKey) : '',
                  })
                }}
              >
                切换为{values.kind === 'service' ? '物品' : '服务'}
              </button>
            )}
            <button className="icon-button cancel-button" type="button" onClick={onClose} title="关闭">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="form-body">
          {values.kind === 'item' ? (
            <>
              <label className="field">
                <span>物品名称</span>
                <input
                  placeholder="例如工作电脑、通勤耳机"
                  value={values.name}
                  onChange={(event) => onChange({ ...values, name: event.target.value })}
                />
              </label>

              <div className="form-section">
                <span>分类</span>
                <CategoryPicker
                  groups={categoryGroups}
                  customSubcategories={customSubcategories}
                  category={values.category}
                  subcategory={values.subcategory}
                  onChange={(nextCategory, nextSubcategory) =>
                    onChange({ ...values, category: nextCategory, subcategory: nextSubcategory })
                  }
                  onAddCustomSubcategory={onAddCustomSubcategory}
                />
              </div>

              <section className="value-panel">
                <button
                  className="value-toggle"
                  type="button"
                  role="switch"
                  aria-checked={values.valueTrackingEnabled}
                  onClick={() => onChange({ ...values, valueTrackingEnabled: !values.valueTrackingEnabled })}
                >
                  <span>
                    <strong>计算日均成本</strong>
                    <em>{values.valueTrackingEnabled ? '用购入金额和开始日期计算日均' : '保留开始日期，不参与成本统计'}</em>
                  </span>
                  <i />
                </button>

                <div className="value-fields open">
                  <div className={values.valueTrackingEnabled ? 'field-grid' : 'field-grid single'}>
                    {values.valueTrackingEnabled && (
                      <label className="field">
                        <span>购入金额</span>
                        <input
                          inputMode="decimal"
                          placeholder="¥"
                          value={values.purchasePriceCny}
                          onChange={(event) => onChange({ ...values, purchasePriceCny: event.target.value })}
                        />
                      </label>
                    )}
                    <div className="field">
                      <span>{values.valueTrackingEnabled ? '开始日期' : '开始日期（可选）'}</span>
                      <ThemeDatePicker
                        label="开始日期"
                        max={todayKey}
                        value={values.purchaseDate}
                        onChange={(purchaseDate) => onChange({ ...values, purchaseDate })}
                      />
                    </div>
                  </div>
                </div>
              </section>

              <label className="field">
                <span>备注</span>
                <textarea value={values.note} onChange={(event) => onChange({ ...values, note: event.target.value })} />
              </label>
            </>
          ) : (
            <ServiceFormContent values={values} todayKey={todayKey} onChange={onChange} />
          )}
        </div>

        <div className="form-footer">
          {error && <p className="form-error">{error}</p>}
          <button className="save-button" type="button" onClick={onSave}>
            <Check size={18} />
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

function ServiceFormContent({
  values,
  todayKey,
  onChange,
}: {
  values: AssetFormValues
  todayKey: string
  onChange: (values: AssetFormValues) => void
}) {
  const isRecurring = isRecurringBillingMode(values.billingMode)
  const isOneTime = values.billingMode === 'one-time'
  const isFree = values.billingMode === 'free'
  const isLegacy = !['monthly', 'yearly', 'one-time', 'free'].includes(values.billingMode)
  const amountLabel = values.billingMode === 'monthly'
    ? '每月费用'
    : values.billingMode === 'yearly'
      ? '每年费用'
      : values.billingMode === 'subscription'
        ? '每周期费用'
        : values.billingMode === 'usage'
          ? '按量费用'
          : '已付金额'

  function changeBilling(billingMode: BillingMode) {
    onChange({
      ...values,
      billingMode,
      billingCycle:
        billingMode === 'monthly'
          ? 'monthly'
          : billingMode === 'yearly'
            ? 'yearly'
            : 'custom',
      serviceAmountCny: values.serviceAmountCny,
      purchaseDate: billingMode === 'one-time' ? (values.purchaseDate || todayKey) : values.purchaseDate,
      autoRenew: billingMode === 'monthly' || billingMode === 'yearly',
    })
  }

  return (
    <div className="service-form">
      <label className="field service-name-field">
        <span>服务名称</span>
        <input
                  placeholder="例如 AI 助手、音乐会员"
          value={values.name}
          onChange={(event) => onChange({ ...values, name: event.target.value })}
        />
      </label>

      <div className="form-section">
        <span>分类</span>
        <div className="service-category-grid" aria-label="选择服务分类">
          {serviceCategories.map((serviceCategory) => (
            <button
              key={serviceCategory}
              className={values.serviceCategory === serviceCategory ? 'service-category-option active' : 'service-category-option'}
              type="button"
              aria-pressed={values.serviceCategory === serviceCategory}
              onClick={() => onChange({ ...values, serviceCategory })}
            >
              <ServiceCategoryIcon category={serviceCategory} />
              <span>{serviceCategory}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="form-section">
        <span>付费方式</span>
        <div className="billing-mode-grid" aria-label="选择付费方式">
          {([
            ['monthly', '月付'],
            ['yearly', '年付'],
            ['one-time', '一次购买'],
            ['free', '免费'],
          ] as const).map(([billingMode, label]) => (
            <button
              key={billingMode}
              className={values.billingMode === billingMode ? 'active' : ''}
              type="button"
              aria-pressed={values.billingMode === billingMode}
              onClick={() => changeBilling(billingMode)}
            >
              {label}
            </button>
          ))}
          {isLegacy && (
            <button className="active" type="button" aria-pressed="true">
              {billingModeLabels[values.billingMode]}
              {values.billingMode === 'subscription' ? `（${billingCycleLabels[values.billingCycle]}）` : ''}
            </button>
          )}
        </div>
      </div>

      <div className="service-essential-card">
        {!isFree && (
          <label className="service-cost-field">
            <span>{amountLabel}</span>
            <div className="service-cost-controls">
              <span className="service-currency">¥</span>
              <input
                inputMode="decimal"
                placeholder="0"
                value={values.serviceAmountCny}
                aria-label={amountLabel}
                onChange={(event) => onChange({ ...values, serviceAmountCny: event.target.value })}
              />
              <span className="service-cost-unit">
                {values.billingMode === 'monthly' ? '/月' : values.billingMode === 'yearly' ? '/年' : values.billingMode === 'subscription' ? '/周期' : values.billingMode === 'usage' ? '按量' : '一次性'}
              </span>
            </div>
          </label>
        )}

        {isRecurring && (
          <>
            <div className="service-row-field">
              <span>{values.autoRenew ? '下次扣款日' : '当前到期日'} <em>（可选）</em></span>
              <ThemeDatePicker
                label={values.autoRenew ? '下次扣款日' : '当前到期日'}
                value={values.nextEventDate}
                onChange={(nextEventDate) => onChange({ ...values, nextEventDate })}
              />
            </div>
            <button
              className="service-setting-row embedded"
              type="button"
              role="switch"
              aria-checked={values.autoRenew}
              onClick={() => onChange({ ...values, autoRenew: !values.autoRenew })}
            >
              <span>
                <strong>自动续费</strong>
                <small>{values.autoRenew ? '到期后自动进入下一周期' : '到期后由我决定是否续费'}</small>
              </span>
              <i className={values.autoRenew ? 'switch-control active' : 'switch-control'} />
            </button>
          </>
        )}

        {isOneTime && (
          <>
            <div className="service-row-field">
              <span>购买日期</span>
              <ThemeDatePicker
                label="购买日期"
                max={todayKey}
                value={values.purchaseDate}
                onChange={(purchaseDate) => onChange({ ...values, purchaseDate })}
              />
            </div>
            <div className="service-row-field">
              <span>到期日 <em>（不填即长期）</em></span>
              <ThemeDatePicker
                label="到期日"
                min={values.purchaseDate || undefined}
                value={values.nextEventDate}
                onChange={(nextEventDate) => onChange({ ...values, nextEventDate })}
              />
            </div>
          </>
        )}

        {isFree && (
          <div className="service-row-field">
            <span>到期日 <em>（不填即长期）</em></span>
            <ThemeDatePicker
              label="到期日"
              value={values.nextEventDate}
              onChange={(nextEventDate) => onChange({ ...values, nextEventDate })}
            />
          </div>
        )}

        {isLegacy && !isRecurring && (
          <div className="service-row-field">
            <span>关键日期 <em>（可选）</em></span>
            <ThemeDatePicker
              label="关键日期"
              value={values.nextEventDate}
              onChange={(nextEventDate) => onChange({ ...values, nextEventDate })}
            />
          </div>
        )}
      </div>

      <p className="service-form-hint">
        {isRecurring
          ? values.nextEventDate
            ? `首页将按该日期显示${values.autoRenew ? '扣款' : '到期'}日程`
            : '补充日期后，可在首页查看续费与到期日程'
          : values.nextEventDate
            ? '可在首页查看到期日程'
            : '不填写到期日即视为长期有效'}
      </p>

      <section className="service-more-panel">
        <button
          className="service-more-toggle"
          type="button"
          aria-expanded={values.showMoreServiceFields}
          onClick={() => onChange({ ...values, showMoreServiceFields: !values.showMoreServiceFields })}
        >
          <span>
            <strong>更多信息</strong>
            {!values.showMoreServiceFields && <small>开始日期、套餐、用途、备注</small>}
          </span>
          {values.showMoreServiceFields ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {values.showMoreServiceFields && (
          <div className="service-more-fields">
            {(isRecurring || isLegacy) && <div className="service-row-field">
              <span>开始日期 <em>（可选）</em></span>
              <ThemeDatePicker
                label="开始日期"
                max={todayKey}
                value={values.purchaseDate}
                onChange={(purchaseDate) => onChange({ ...values, purchaseDate })}
              />
            </div>}
            <label className="service-row-field">
              <span>套餐 <em>（可选）</em></span>
              <input
                placeholder="例如 Pro、家庭版"
                value={values.planName}
                onChange={(event) => onChange({ ...values, planName: event.target.value })}
              />
            </label>

            {values.serviceCategory === 'AI服务' && (
              <div className="usage-tags-field">
                <span>用途标签 <em>（可选）</em></span>
                <div className="usage-tag-list">
                  {aiUsageTags.map((tag) => {
                    const active = values.usageTags.includes(tag)
                    return (
                      <button
                        key={tag}
                        className={active ? 'active' : ''}
                        type="button"
                        onClick={() => onChange({
                          ...values,
                          usageTags: active
                            ? values.usageTags.filter((item) => item !== tag)
                            : [...values.usageTags, tag],
                        })}
                      >
                        {tag}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <label className="field service-note-field">
              <span>备注（可选）</span>
              <textarea
                placeholder="补充使用场景或续费说明"
                value={values.note}
                onChange={(event) => onChange({ ...values, note: event.target.value })}
              />
            </label>
          </div>
        )}
      </section>
    </div>
  )
}

function formatHeldText(asset: Pick<ComputedAsset, 'daysHeld'>) {
  return asset.daysHeld === null ? '仅记录' : `拥有 ${asset.daysHeld} 天`
}

function AssetDetail({
  asset,
  customSubcategories,
  isClosing,
  onClose,
  onEdit,
  onDelete,
}: {
  asset: ComputedAsset
  customSubcategories: CustomSubcategory[]
  isClosing: boolean
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className={isClosing ? 'sheet-backdrop closing' : 'sheet-backdrop'} role="dialog" aria-modal="true" aria-label="物品详情">
      <div className="sheet detail-sheet">
        <div className="sheet-header compact">
          <h2 className="user-copyable">{asset.name}</h2>
          <button className="icon-button cancel-button" type="button" onClick={onClose} title="关闭">
            <X size={18} />
          </button>
        </div>

        <div className="detail-hero">
          <CategoryEmblem category={asset.category} subcategory={asset.subcategory} customSubcategories={customSubcategories} size="detail" />
          <div className="detail-hero-copy">
            <span>{getSubcategoryDisplayName(asset.category, asset.subcategory, customSubcategories)}</span>
            <strong>{asset.valueTrackingEnabled ? formatAssetDailyCost(asset) : '仅收藏'}</strong>
            <em>{formatHeldText(asset)}</em>
          </div>
        </div>

        <div className="detail-list">
          <DetailRow label="分类" value={`${getCategoryDisplayName(asset.category)} / ${getSubcategoryDisplayName(asset.category, asset.subcategory, customSubcategories)}`} />
          <DetailRow label="日均计算" value={asset.valueTrackingEnabled ? '开启' : '关闭'} />
          {asset.purchaseDate && <DetailRow label="开始日期" value={asset.purchaseDate} copyable />}
          {asset.valueTrackingEnabled && (
            <>
              <DetailRow label="购入金额" value={formatCny(asset.purchasePriceCny)} copyable />
            </>
          )}
        </div>

        {asset.note && <p className="note user-copyable">{asset.note}</p>}

        <div className="sheet-actions">
          <button type="button" onClick={onEdit}>
            <Edit3 size={18} />
            编辑
          </button>
          <button className="danger" type="button" onClick={onDelete}>
            <Trash2 size={18} />
            删除
          </button>
        </div>
      </div>
    </div>
  )
}

function ServiceDetail({
  service,
  isClosing,
  onClose,
  onEdit,
  onDelete,
}: {
  service: ComputedService
  isClosing: boolean
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const billingMode = service.billingMode ?? 'subscription'
  const billingCycle = service.billingCycle ?? 'monthly'
  const isRecurring = isRecurringBillingMode(billingMode)
  const lacksOneTimeStart = (
    billingMode === 'one-time'
    || billingMode === 'fixed'
    || billingMode === 'credit'
  ) && !service.purchaseDate
  const dailyCostText = lacksOneTimeStart ? '待计算' : formatDailyCny(service.dailyCost)
  const eventDateText = service.effectiveNextEventDate
    || (billingMode === 'one-time' || billingMode === 'free' || billingMode === 'fixed' ? '长期有效' : '未填写')
  const eventLabel = isRecurring
    ? service.autoRenew !== false ? '下次扣款' : '当前到期'
    : '有效期'

  return (
    <div className={isClosing ? 'sheet-backdrop closing' : 'sheet-backdrop'} role="dialog" aria-modal="true" aria-label="服务详情">
      <div className="sheet detail-sheet">
        <div className="sheet-header compact">
          <h2 className="user-copyable">{service.name}</h2>
          <button className="icon-button cancel-button" type="button" onClick={onClose} title="关闭">
            <X size={18} />
          </button>
        </div>

        <div className="detail-hero service-detail-hero">
          <div className="service-detail-icon">
            <ServiceCategoryIcon category={service.serviceCategory ?? '其他'} variant="detail" />
          </div>
          <div className="detail-hero-copy">
            <span>{service.serviceCategory ?? '其他'}</span>
            <strong>{dailyCostText}</strong>
            <em>
              {service.effectiveNextEventDate
                ? `${formatServiceCountdown(service.eventDays)}${getServiceEventNoun(billingMode)}`
                : isRecurring
                  ? '待补充日期'
                  : '长期有效'}
            </em>
          </div>
        </div>

        <div className="detail-list">
          <DetailRow label="服务分类" value={service.serviceCategory ?? '其他'} />
          <DetailRow label="付费方式" value={billingModeLabels[billingMode]} />
          {billingMode === 'subscription' && <DetailRow label="付费周期" value={billingCycleLabels[billingCycle]} />}
          <DetailRow label="实际支付" value={formatServicePayment(service)} copyable />
          <DetailRow label="日均成本" value={dailyCostText} />
          <DetailRow label="折合月均" value={formatCny(service.monthlyEquivalentCny).replace(/\.00$/, '')} />
          <DetailRow label={eventLabel} value={eventDateText} copyable={Boolean(service.effectiveNextEventDate)} />
          {isRecurring && <DetailRow label="续费方式" value={service.autoRenew === false ? '手动续费' : '自动续费'} />}
          {service.purchaseDate && <DetailRow label={billingMode === 'one-time' ? '购买日期' : '开始日期'} value={service.purchaseDate} copyable />}
          {service.planName && <DetailRow label="套餐" value={service.planName} copyable />}
          {service.usageTags?.length ? <DetailRow label="用途标签" value={service.usageTags.join('、')} copyable /> : null}
        </div>

        {service.note && <p className="note user-copyable">{service.note}</p>}

        <div className="sheet-actions">
          <button type="button" onClick={onEdit}>
            <Edit3 size={18} />
            编辑
          </button>
          <button className="danger" type="button" onClick={onDelete}>
            <Trash2 size={18} />
            删除
          </button>
        </div>
      </div>
    </div>
  )
}

function AssetCard({
  asset,
  customSubcategories,
  onOpen,
}: {
  asset: ComputedAsset
  customSubcategories: CustomSubcategory[]
  onOpen: (id: string) => void
}) {
  return (
    <button className="asset-card" type="button" onClick={() => onOpen(asset.id)}>
      <CategoryEmblem category={asset.category} subcategory={asset.subcategory} customSubcategories={customSubcategories} />
      <div className="asset-card-body">
        <div>
          <h3 className="user-copyable">{asset.name}</h3>
          <p>{getSubcategoryDisplayName(asset.category, asset.subcategory, customSubcategories)} · {asset.valueTrackingEnabled ? formatCny(asset.purchasePriceCny) : '仅收藏'} · {formatHeldText(asset)}</p>
        </div>
        <strong>{asset.valueTrackingEnabled ? formatAssetDailyCost(asset) : '仅收藏'}</strong>
      </div>
      <ChevronRight size={18} />
    </button>
  )
}

function ServiceCard({
  service,
  onOpen,
}: {
  service: ComputedService
  onOpen: (id: string) => void
}) {
  const billingMode = service.billingMode ?? 'subscription'
  const lacksOneTimeStart = (
    billingMode === 'one-time'
    || billingMode === 'fixed'
    || billingMode === 'credit'
  ) && !service.purchaseDate
  const dailyValue = lacksOneTimeStart ? '待计算' : formatDailyCny(service.dailyCost)
  const eventText = service.effectiveNextEventDate
    ? getServiceEventDescription(service)
    : isRecurringBillingMode(service.billingMode)
      ? '待补充日期'
      : '长期有效'

  return (
    <button className="asset-card service-card" type="button" onClick={() => onOpen(service.id)}>
      <div className="category-emblem regular service-category-emblem">
        <ServiceCategoryIcon category={service.serviceCategory ?? '其他'} />
      </div>
      <div className="asset-card-body">
        <div>
          <h3 className="user-copyable">{service.name}</h3>
          <p>{service.serviceCategory ?? '其他'} · {formatServicePayment(service)} · {eventText}</p>
        </div>
        <strong>{dailyValue}</strong>
      </div>
      <ChevronRight size={18} />
    </button>
  )
}

function TimelineRow({
  asset,
  index,
  durationUnit,
  customSubcategories,
  onToggleDuration,
  onOpen,
}: {
  asset: ComputedAsset
  index: number
  durationUnit: 'days' | 'years'
  customSubcategories: CustomSubcategory[]
  onToggleDuration: () => void
  onOpen: (id: string) => void
}) {
  const recordDate = asset.purchaseDate || '未记录时间'
  const recordValue = asset.valueTrackingEnabled ? formatCny(asset.purchasePriceCny).replace(/\.00$/, '') : null
  const nameCharacters = Array.from(asset.name)
  const displayName = nameCharacters.length > 15
    ? `${nameCharacters.slice(0, 12).join('')}...`
    : asset.name
  const usesCompactName = nameCharacters.length >= 13
  const durationValue = asset.daysHeld === null
    ? '—'
    : durationUnit === 'years'
      ? asset.daysHeld / 365 < 0.1
        ? '<0.1'
        : (asset.daysHeld / 365).toFixed(1)
      : String(asset.daysHeld)
  const durationLabel = asset.daysHeld === null ? '' : durationUnit === 'years' ? '年' : '天'

  return (
    <div
      className="timeline-row"
      style={{ '--timeline-index': index } as CSSProperties}
    >
      <button
        className="timeline-duration"
        type="button"
        onClick={onToggleDuration}
        aria-label={`当前按${durationUnit === 'days' ? '天数' : '年数'}显示，点击切换为${durationUnit === 'days' ? '年数' : '天数'}`}
      >
        <strong>{durationValue}</strong>
        <small>{durationLabel}</small>
      </button>
      <span className="timeline-rail" aria-hidden="true">
        <i />
      </span>
      <button
        className="timeline-row-main"
        type="button"
        onClick={() => onOpen(asset.id)}
        aria-label={`${asset.name}，${formatHeldText(asset)}，${asset.valueTrackingEnabled ? formatAssetDailyCost(asset) : '仅收藏'}`}
      >
        <CategoryEmblem category={asset.category} subcategory={asset.subcategory} customSubcategories={customSubcategories} size="collection" />
        <div className="timeline-copy">
          <h3 className={`${usesCompactName ? 'compact-name ' : ''}user-copyable`}>{displayName}</h3>
          <span className="timeline-records">
            <span className={asset.purchaseDate ? 'user-copyable' : undefined}>{recordDate}</span>
            {recordValue && <span className="user-copyable">{recordValue}</span>}
          </span>
        </div>
        <strong className={asset.valueTrackingEnabled ? 'timeline-value' : 'timeline-value collection-value'}>
          {asset.valueTrackingEnabled ? formatAssetDailyCost(asset) : '仅收藏'}
        </strong>
      </button>
    </div>
  )
}

function ServiceTimelineRow({
  service,
  index,
  onOpen,
}: {
  service: ComputedService
  index: number
  onOpen: (id: string) => void
}) {
  const billingMode = service.billingMode ?? 'subscription'
  const isLongTerm = !service.effectiveNextEventDate
    && (billingMode === 'one-time' || billingMode === 'free' || billingMode === 'fixed')
  const countdownText = isLongTerm ? '长期' : formatServiceCountdown(service.eventDays)
  const eventDescription = isLongTerm
    ? '长期有效'
    : service.eventDays !== null && service.eventDays < 0
      ? `${service.effectiveNextEventDate}已到期`
      : getServiceEventDescription(service)
  const paymentText = formatServicePayment(service)
  const lacksOneTimeStart = (
    billingMode === 'one-time'
    || billingMode === 'fixed'
    || billingMode === 'credit'
  ) && !service.purchaseDate
  const sideValue = lacksOneTimeStart ? '待计算' : formatDailyCny(service.dailyCost)

  return (
    <div className="timeline-row service-timeline-row" style={{ '--timeline-index': index } as CSSProperties}>
      <div className="timeline-duration service-countdown" aria-label={countdownText}>
        <strong>{countdownText}</strong>
      </div>
      <span className="timeline-rail" aria-hidden="true"><i /></span>
      <button
        className="timeline-row-main"
        type="button"
        onClick={() => onOpen(service.id)}
        aria-label={`${service.name}，${eventDescription}，${paymentText}，日均成本${sideValue}`}
      >
        <div className="category-emblem collection service-category-emblem">
          <ServiceCategoryIcon category={service.serviceCategory ?? '其他'} />
        </div>
        <div className="timeline-copy">
          <h3 className="user-copyable">{service.name}</h3>
          <span className="timeline-records">
            <span className={service.effectiveNextEventDate ? 'user-copyable' : undefined}>{eventDescription}</span>
            <span className="user-copyable">{paymentText}</span>
          </span>
        </div>
        <strong className="timeline-value">{sideValue}</strong>
      </button>
    </div>
  )
}

function ServiceCategoryIcon({
  category,
  variant = 'compact',
}: {
  category: ServiceCategory
  variant?: 'compact' | 'detail'
}) {
  return <ServiceCategoryGlyph category={category} variant={variant} />
}

function CategoryPicker({
  groups,
  customSubcategories,
  category,
  subcategory,
  onChange,
  onAddCustomSubcategory,
}: {
  groups: ReturnType<typeof getCategoryGroups>
  customSubcategories: CustomSubcategory[]
  category: Category
  subcategory: Subcategory
  onChange: (category: Category, subcategory: Subcategory) => void
  onAddCustomSubcategory: (category: Category, name: string, previousName?: string) => Promise<Subcategory | null>
}) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingCustomName, setEditingCustomName] = useState<string | undefined>()
  const [isSavingCustom, setIsSavingCustom] = useState(false)
  const savingCustomRef = useRef(false)
  const [customName, setCustomName] = useState('')
  const [customError, setCustomError] = useState('')
  const [selectionSuppressed, setSelectionSuppressed] = useState(false)
  const [subcategoryPage, setSubcategoryPage] = useState(0)
  const categoryCarouselRef = useRef<HTMLDivElement>(null)
  const categoryScrollFrameRef = useRef<number | null>(null)
  const pickerGroups = useMemo(() => {
    if (groups.some((group) => group.name === category)) return groups
    // Editing a historical group must never silently select a different kind.
    const legacy = getCategoryGroups(customSubcategories).find((group) => group.name === category)
    return legacy ? [...groups, legacy] : groups
  }, [groups, category, customSubcategories])
  const activeGroup = useMemo(() => {
    const group = pickerGroups.find((candidate) => candidate.name === category) ?? pickerGroups[0]
    if (group.items.some((item) => item.name === subcategory)) return group
    const selected = getSubcategoryMeta(subcategory, customSubcategories, category)
    return { ...group, items: [...group.items, selected] }
  }, [pickerGroups, category, subcategory, customSubcategories])
  const selectedCustom = getSubcategoryMeta(subcategory, [], activeGroup.name).iconKey
    ? undefined
    : customSubcategories.find((item) => item.category === activeGroup.name && item.name === subcategory)
  const categoryEntries: Array<
    { kind: 'item'; item: CategoryItem } | { kind: 'add' }
  > = [
    ...activeGroup.items.map((item) => ({ kind: 'item' as const, item })),
    { kind: 'add' },
  ]
  const subcategoryPages = Array.from(
    { length: Math.ceil(categoryEntries.length / 9) },
    (_, index) => categoryEntries.slice(index * 9, index * 9 + 9),
  )

  useEffect(() => {
    const selectedIndex = activeGroup.items.findIndex((item) => item.name === subcategory)
    const nextPage = selectedIndex < 0 ? 0 : Math.floor(selectedIndex / 9)
    const frame = window.requestAnimationFrame(() => {
      const carousel = categoryCarouselRef.current
      setSubcategoryPage(nextPage)
      if (carousel) scrollHorizontally(carousel, carousel.clientWidth * nextPage, 'auto')
    })

    return () => window.cancelAnimationFrame(frame)
  }, [activeGroup.items, activeGroup.name, subcategory])

  useEffect(() => () => {
    if (categoryScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(categoryScrollFrameRef.current)
    }
  }, [])

  function scrollToSubcategoryPage(page: number) {
    const carousel = categoryCarouselRef.current
    if (!carousel) return

    const nextPage = Math.max(0, Math.min(page, subcategoryPages.length - 1))
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    scrollHorizontally(
      carousel,
      carousel.clientWidth * nextPage,
      reduceMotion ? 'auto' : 'smooth',
    )
    setSubcategoryPage(nextPage)
  }

  function handleSubcategoryScroll() {
    if (categoryScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(categoryScrollFrameRef.current)
    }

    categoryScrollFrameRef.current = window.requestAnimationFrame(() => {
      const carousel = categoryCarouselRef.current
      if (!carousel?.clientWidth) return

      const nextPage = Math.round(carousel.scrollLeft / carousel.clientWidth)
      setSubcategoryPage(Math.max(0, Math.min(nextPage, subcategoryPages.length - 1)))
    })
  }

  function resetCustomForm() {
    setIsAdding(false)
    setEditingCustomName(undefined)
    setCustomName('')
    setCustomError('')
  }

  function closeCustomWithoutSelection() {
    resetCustomForm()
    setSelectionSuppressed(true)
  }

  async function handleSaveCustom() {
    if (savingCustomRef.current) return
    const cleanName = customName.trim()

    if (!cleanName) {
      setCustomError('先给新种类起个名字')
      return
    }

    const builtIn = getSubcategoryMeta(cleanName, [], activeGroup.name)
    if (builtIn.iconKey && builtIn.category !== activeGroup.name) {
      setCustomError(`${cleanName}已在${getCategoryDisplayName(builtIn.category)}中，请直接选择`)
      return
    }

    if (cleanName !== editingCustomName && activeGroup.items.some((item) => item.name !== editingCustomName
      && (item.name === cleanName || getSubcategoryDisplayName(activeGroup.name, item.name, customSubcategories) === cleanName))) {
      setCustomError('已有同名种类，请直接选择或换个名称')
      return
    }

    savingCustomRef.current = true
    setIsSavingCustom(true)
    try {
      const nextSubcategory = await onAddCustomSubcategory(activeGroup.name, cleanName, editingCustomName)
      if (!nextSubcategory) {
        setCustomError('种类未保存，请重试')
        return
      }
      onChange(activeGroup.name, nextSubcategory)
      resetCustomForm()
      setSelectionSuppressed(false)
    } finally {
      savingCustomRef.current = false
      setIsSavingCustom(false)
    }
  }

  return (
    <div className="category-picker" aria-label="选择分类">
      <div className="primary-tabs">
        {pickerGroups.map((group) => (
          <button
            key={group.name}
            className={group.name === category ? 'active' : ''}
            type="button"
            disabled={isSavingCustom}
            onClick={() => {
              resetCustomForm()
              setSelectionSuppressed(false)
              onChange(group.name, getDefaultSubcategory(group.name))
            }}
          >
            {getCategoryDisplayName(group.name)}
          </button>
        ))}
      </div>
      <div
        ref={categoryCarouselRef}
        className={subcategoryPages.length === 1 ? 'subcategory-carousel single-page' : 'subcategory-carousel'}
        aria-label={`${getCategoryDisplayName(activeGroup.name)}分类，共${subcategoryPages.length}页`}
        onScroll={handleSubcategoryScroll}
      >
        {subcategoryPages.map((page, pageIndex) => (
          <div
            key={`${activeGroup.name}-${pageIndex}`}
            className="subcategory-page"
            aria-label={`第${pageIndex + 1}页，共${subcategoryPages.length}页`}
          >
            {page.map((entry) => entry.kind === 'item' ? (
              <button
                key={entry.item.name}
                className={!isAdding && !selectionSuppressed && entry.item.name === subcategory ? 'category-option active' : 'category-option'}
                type="button"
                disabled={isSavingCustom}
                onClick={() => {
                  resetCustomForm()
                  setSelectionSuppressed(false)
                  onChange(activeGroup.name, entry.item.name)
                }}
              >
                <span className="emoji-emblem small">
                  <CategoryIcon visual={entry.item} />
                </span>
                <span>{getSubcategoryDisplayName(activeGroup.name, entry.item.name, customSubcategories)}
                  {customSubcategories.some((item) => item.category === activeGroup.name && item.name === entry.item.name)
                    && activeGroup.items.some((other) => other.name !== entry.item.name
                    && getSubcategoryDisplayName(activeGroup.name, other.name, customSubcategories) === getSubcategoryDisplayName(activeGroup.name, entry.item.name, customSubcategories))
                    ? '（自定义）' : ''}
                </span>
              </button>
            ) : (
              <button
                key="add-custom"
                className={isAdding ? 'category-option add active' : 'category-option add'}
                type="button"
                disabled={isSavingCustom}
                onClick={() => {
                  if (isAdding) {
                    closeCustomWithoutSelection()
                    return
                  }

                  resetCustomForm()
                  setIsAdding(true)
                  setSelectionSuppressed(true)
                  setCustomError('')
                }}
              >
                <span className="emoji-emblem small">
                  <Plus size={18} />
                </span>
                <span>自定义</span>
              </button>
            ))}
          </div>
        ))}
      </div>
      {subcategoryPages.length > 1 && (
        <div className="subcategory-pagination" aria-label="分类分页">
          {subcategoryPages.map((_, pageIndex) => (
            <button
              key={pageIndex}
              className={pageIndex === subcategoryPage ? 'active' : ''}
              type="button"
              onClick={() => scrollToSubcategoryPage(pageIndex)}
              aria-label={`前往第${pageIndex + 1}页`}
              aria-current={pageIndex === subcategoryPage ? 'page' : undefined}
            />
          ))}
        </div>
      )}
      {selectedCustom && !isAdding && !selectionSuppressed && (
        <button
          type="button"
          className="edit-custom-category"
          onClick={() => {
            setEditingCustomName(selectedCustom.name)
            setCustomName(selectedCustom.name)
            setCustomError('')
            setIsAdding(true)
          }}
        >
          <Edit3 size={14} /> 编辑种类
        </button>
      )}
      {isAdding && (
        <div className="custom-category-panel" role="group" aria-label={editingCustomName ? '编辑自定义种类' : '新增自定义种类'}>
          <div className="custom-category-fields">
            <div className="custom-kind-preview" aria-hidden="true">
              <CustomKindGlyph name={customName} />
            </div>
            <label className="field compact grow">
              <span>种类名称</span>
              <input
                maxLength={8}
                placeholder="例如 三脚架"
                value={customName}
                disabled={isSavingCustom}
                onChange={(event) => {
                  setCustomName(event.target.value)
                  setCustomError('')
                }}
              />
            </label>
          </div>
          {customError && <p role="alert">{customError}</p>}
          <div className="custom-category-actions">
            <button type="button" disabled={isSavingCustom} onClick={closeCustomWithoutSelection}>
              取消
            </button>
            <button type="button" disabled={isSavingCustom} onClick={() => void handleSaveCustom()}>
              {isSavingCustom ? '保存中…' : editingCustomName ? '保存种类' : '添加种类'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function CategoryEmblem({
  category,
  subcategory,
  customSubcategories = [],
  size = 'regular',
}: {
  category: Category
  subcategory: Subcategory
  customSubcategories?: CustomSubcategory[]
  size?: 'regular' | 'collection' | 'detail'
}) {
  const visual = getSubcategoryMeta(subcategory, customSubcategories, category)

  return (
    <div className={`category-emblem ${size}`}>
      <span className="emblem-sheen" />
      <CategoryIcon visual={visual} variant={size === 'detail' ? 'detail' : 'compact'} />
      <small>{visual.name}</small>
    </div>
  )
}

function CategoryIcon({
  visual,
  variant = 'compact',
}: {
  visual: Pick<CategoryItem, 'name' | 'iconKey'>
  variant?: 'compact' | 'detail'
}) {
  if (visual.iconKey) {
    return <ItemCategoryGlyph iconKey={visual.iconKey} variant={variant} />
  }

  return <CustomKindGlyph name={visual.name} variant={variant} />
}

function DetailRow({ label, value, copyable = false }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong className={copyable ? 'user-copyable' : undefined}>{value}</strong>
    </div>
  )
}

function ThemedDialog({
  dialog,
  onResult,
}: {
  dialog: AppDialogState
  onResult: (confirmed: boolean) => void
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onResult(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onResult])

  return (
    <div
      className="app-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && dialog.cancelLabel) onResult(false)
      }}
    >
      <section className="app-dialog" role="alertdialog" aria-modal="true" aria-labelledby="app-dialog-title">
        <div className={dialog.danger ? 'app-dialog-icon danger' : 'app-dialog-icon'} aria-hidden="true">
          <AlertTriangle size={22} />
        </div>
        <div className="app-dialog-copy">
          <h2 id="app-dialog-title">{dialog.title}</h2>
          <p>{dialog.message}</p>
        </div>
        <div className={dialog.cancelLabel ? 'app-dialog-actions' : 'app-dialog-actions single'}>
          {dialog.cancelLabel && (
            <button type="button" autoFocus onClick={() => onResult(false)}>{dialog.cancelLabel}</button>
          )}
          <button
            className={dialog.danger ? 'danger' : 'primary'}
            type="button"
            autoFocus={!dialog.cancelLabel}
            onClick={() => onResult(true)}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}

function AppToast({ message }: { message: string }) {
  return (
    <div className="app-toast" role="status" aria-live="polite">
      <Check size={17} />
      <span>{message}</span>
    </div>
  )
}

function EmptyState({ kind, onCreate }: { kind: RecordKind; onCreate: () => void }) {
  const isService = kind === 'service'
  return (
    <div className="empty-state">
      {isService ? <Sparkles size={28} /> : <Archive size={28} />}
      <h2>{isService ? '还没有服务' : '还没有物品'}</h2>
      <button type="button" onClick={onCreate}>
        <Plus size={18} />
        {isService ? '添加服务' : '添加物品'}
      </button>
    </div>
  )
}

function NavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button type="button" className={active ? 'active' : ''} aria-label={label} title={label} onClick={onClick}>
      {icon}
    </button>
  )
}

export default App
