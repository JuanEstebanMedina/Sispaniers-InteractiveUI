import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns'
import { enUS, es, ptBR } from 'date-fns/locale'

import { currentIntlLocale, currentLocale, type Locale } from '@/i18n'

const dateLocales = { es, en: enUS, 'pt-BR': ptBR }

const ZERO_DECIMAL_CURRENCIES = new Set([
  'CLP', 'JPY', 'KRW', 'VND', 'PYG', 'ISK', 'XAF', 'XOF',
  'BIF', 'DJF', 'GNF', 'KMF', 'RWF', 'UGX', 'VUV',
])

const THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'OMR', 'TND', 'LYD'])

export function currencyDecimals(currency: string): number {
  const code = currency.toUpperCase()
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 3
  return 2
}

export function fromMinorUnits(amount: number, currency: string): number {
  return amount / 10 ** currencyDecimals(currency)
}

export function toMinorUnits(amount: number, currency: string): number {
  return Math.round(amount * 10 ** currencyDecimals(currency))
}

interface MoneyOptions {
  minor?: boolean
  locale?: Locale
  showCode?: boolean
  compact?: boolean
  signed?: boolean
}

export function formatMoney(
  amount: number | null | undefined,
  currency = 'USD',
  options: MoneyOptions = {},
): string {
  if (amount == null || Number.isNaN(amount)) return '—'

  const { minor = true, locale, showCode = false, compact = false, signed = false } = options

  const code = currency.toUpperCase()
  const decimals = currencyDecimals(code)
  const value = minor ? fromMinorUnits(amount, code) : amount
  const intlLocale = locale ? localeToIntl(locale) : currentIntlLocale()

  try {
    return new Intl.NumberFormat(intlLocale, {
      style: 'currency',
      currency: code,
      currencyDisplay: showCode ? 'code' : 'narrowSymbol',
      notation: compact ? 'compact' : 'standard',
      minimumFractionDigits: compact ? 0 : decimals,
      maximumFractionDigits: compact ? 1 : decimals,
      signDisplay: signed ? 'exceptZero' : 'auto',
    }).format(value)
  } catch {
    return `${formatNumber(value, { locale, decimals })} ${code}`
  }
}

function localeToIntl(locale: Locale): string {
  return locale === 'es' ? 'es-CO' : locale === 'en' ? 'en-US' : 'pt-BR'
}

interface NumberOptions {
  locale?: Locale
  decimals?: number
  compact?: boolean
}

export function formatNumber(
  value: number | null | undefined,
  { locale, decimals = 0, compact = false }: NumberOptions = {},
): string {
  if (value == null || Number.isNaN(value)) return '—'

  return new Intl.NumberFormat(locale ? localeToIntl(locale) : currentIntlLocale(), {
    notation: compact ? 'compact' : 'standard',
    minimumFractionDigits: compact ? 0 : decimals,
    maximumFractionDigits: compact ? 1 : decimals,
  }).format(value)
}

export function formatPercent(
  value: number | null | undefined,
  { locale, decimals = 1, signed = false }: NumberOptions & { signed?: boolean } = {},
): string {
  if (value == null || Number.isNaN(value)) return '—'

  return new Intl.NumberFormat(locale ? localeToIntl(locale) : currentIntlLocale(), {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(value)
}

export function toDate(input: string | number | Date | null | undefined): Date | null {
  if (input == null) return null
  const date =
    input instanceof Date ? input : typeof input === 'number' ? new Date(input) : parseISO(input)
  return isValid(date) ? date : null
}

const DATE_PATTERNS = {
  short: 'dd/MM/yy',
  medium: 'dd MMM yyyy',
  long: "d 'de' MMMM 'de' yyyy",
  datetime: 'dd/MM/yy HH:mm',
  time: 'HH:mm',
  timeSeconds: 'HH:mm:ss',
  compact: 'dd MMM, HH:mm',
} as const

export type DatePattern = keyof typeof DATE_PATTERNS

export function formatDate(
  input: string | number | Date | null | undefined,
  pattern: DatePattern = 'medium',
  locale?: Locale,
): string {
  const date = toDate(input)
  if (!date) return '—'
  return format(date, DATE_PATTERNS[pattern], { locale: dateLocales[locale ?? currentLocale()] })
}

export function formatCalendarDate(
  input: string | number | Date | null | undefined,
  pattern: DatePattern = 'medium',
  locale?: Locale,
): string {
  const date = toDate(input)
  if (!date) return '—'

  const asLocalCalendar = new Date(date.getTime() + date.getTimezoneOffset() * 60_000)
  return format(asLocalCalendar, DATE_PATTERNS[pattern], {
    locale: dateLocales[locale ?? currentLocale()],
  })
}

/** Relative for the last week, absolute after that — "hace 43 días" is noise. */
export function formatRelative(
  input: string | number | Date | null | undefined,
  locale?: Locale,
): string {
  const date = toDate(input)
  if (!date) return '—'
  return formatDistanceToNowStrict(date, {
    addSuffix: true,
    locale: dateLocales[locale ?? currentLocale()],
  })
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`

  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  if (hours < 24) return restMinutes ? `${hours}h ${restMinutes}m` : `${hours}h`

  const days = Math.floor(hours / 24)
  const restHours = hours % 24
  return restHours ? `${days}d ${restHours}h` : `${days}d`
}

export function truncateId(id: string | null | undefined, head = 8, tail = 4): string {
  if (!id) return '—'
  if (id.length <= head + tail + 1) return id
  return `${id.slice(0, head)}…${id.slice(-tail)}`
}

export function formatBytes(bytes: number | null | undefined, decimals = 1): string {
  if (bytes == null || Number.isNaN(bytes)) return '—'
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index

  return `${formatNumber(value, { decimals: index === 0 ? 0 : decimals })} ${units[index]}`
}

export function initials(name: string | null | undefined, max = 2): string {
  if (!name?.trim()) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, max)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function humanize(value: string | null | undefined): string {
  if (!value) return '—'
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/^./, (char) => char.toUpperCase())
}
