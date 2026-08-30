import {
  File,
  FileArchive,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  Presentation,
} from 'lucide-react'
import { Fragment, lazy, Suspense, type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, YAxis } from 'recharts'

import { http } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import { BreakdownChart, CategoryChart, TrendChart, type Series } from '@/components/charts/Charts'
import { ChartTooltip } from '@/components/charts/ChartTooltip'
import { axisProps, cursorProps, gridProps } from '@/components/charts/chartTheme'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { toast } from '@/lib/toast'
import {
  CHART_COLOR,
  SOFT_COLOR,
  SOLID_COLOR,
  TEXT_COLOR,
  isColorName,
  type ColorName,
} from './colors'
import { useDataset, useOperation } from './ComponentData'
import { useNode, useProps, type PropReader } from './NodeContext'

const DIRECTIONS = ['row', 'column'] as const
const GAPS = ['none', 'xs', 'sm', 'md', 'lg'] as const
const ALIGNS = ['start', 'center', 'end', 'stretch'] as const
const JUSTIFIES = ['start', 'center', 'end', 'between'] as const

type Gap = (typeof GAPS)[number]
type Align = (typeof ALIGNS)[number]
type Justify = (typeof JUSTIFIES)[number]

const GAP_CLASS: Record<Gap, string> = {
  none: 'gap-0',
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-4',
}

const ALIGN_CLASS: Record<Align, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
}

const JUSTIFY_CLASS: Record<Justify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
}

export function colorOf(props: PropReader, fallback: ColorName): ColorName {
  for (const key of ['color', 'tone', 'status'] as const) {
    const value = props.str(key)
    if (isColorName(value)) return value
    if (value === 'neutral') return 'muted'
  }
  return fallback
}

export function Layout({ children }: { children?: ReactNode }) {
  const props = useProps()

  return (
    <div
      className={cn(
        'flex min-w-0',
        props.oneOf('direction', DIRECTIONS, 'column') === 'row' ? 'flex-row' : 'flex-col',
        GAP_CLASS[props.oneOf('gap', GAPS, 'sm')],
        ALIGN_CLASS[props.oneOf('align', ALIGNS, 'stretch')],
        JUSTIFY_CLASS[props.oneOf('justify', JUSTIFIES, 'start')],
        props.bool('wrap') && 'flex-wrap',
      )}
    >
      {children}
    </div>
  )
}

export function Title() {
  const props = useProps()
  return (
    <h4
      className={cn(
        'truncate font-display text-sm font-semibold tracking-tight',
        TEXT_COLOR[colorOf(props, 'default')],
      )}
    >
      {props.str('text')}
    </h4>
  )
}

export function Label() {
  const props = useProps()
  return (
    <p className={cn('text-pretty text-xs', TEXT_COLOR[colorOf(props, 'muted')])}>
      {props.str('text')}
    </p>
  )
}

export function Stat() {
  const props = useProps()
  const label = props.text('label')

  return (
    <div className="min-w-0">
      <p
        className={cn(
          'truncate font-mono text-lg font-semibold tabular',
          TEXT_COLOR[colorOf(props, 'default')],
        )}
      >
        {props.str('value', '—')}
      </p>
      {label && <p className="mt-0.5 truncate text-2xs text-fg-subtle">{label}</p>}
    </div>
  )
}

export function Button() {
  const props = useProps()
  return (
    <button
      type="button"
      disabled
      title={`${props.action()} — sin conectar`}
      className={cn(
        'inline-flex h-control-sm shrink-0 items-center rounded-md border px-3',
        'text-xs font-medium',
        SOFT_COLOR[colorOf(props, 'muted')],
        'cursor-not-allowed opacity-60',
      )}
    >
      {props.str('label', 'Acción')}
    </button>
  )
}

export function EmailAction() {
  const props = useProps()
  const { t } = useTranslation('domain')
  const operation = useOperation()

  const [to, setTo] = useState(props.str('to'))
  const [subject, setSubject] = useState(props.str('subject'))
  const [body, setBody] = useState(props.str('body'))
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')

  const canSend = status === 'idle' && to.trim() !== '' && subject.trim() !== '' && body.trim() !== ''

  async function send() {
    if (!canSend) {
      toast.warning(t('operation.emailAction.missingFields'))
      return
    }

    setStatus('sending')
    try {
      await http.post(endpoints.emails.send, {
        run_id: operation?.trackId ?? 'unknown',
        to: to.trim(),
        subject: subject.trim(),
        body_text: body.trim(),
      })
      setStatus('sent')
      toast.success(t('operation.emailAction.sent'))
    } catch (error) {
      setStatus('idle')
      toast.apiError(error)
    }
  }

  const fieldClass = cn(
    'rounded-xs border border-line bg-surface px-2 py-1 text-xs text-fg',
    'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
    'disabled:opacity-60',
  )

  return (
    <div className="flex min-h-40 min-w-0 flex-1 flex-col gap-1.5">
      <label className="flex flex-col gap-0.5 text-2xs text-fg-subtle">
        {t('operation.emailAction.to')}
        <input
          type="email"
          value={to}
          disabled={status === 'sent'}
          onChange={(event) => setTo(event.target.value)}
          className={fieldClass}
        />
      </label>
      <label className="flex flex-col gap-0.5 text-2xs text-fg-subtle">
        {t('operation.emailAction.subject')}
        <input
          value={subject}
          disabled={status === 'sent'}
          onChange={(event) => setSubject(event.target.value)}
          className={fieldClass}
        />
      </label>
      <label className="flex min-h-0 flex-1 flex-col gap-0.5 text-2xs text-fg-subtle">
        {t('operation.emailAction.body')}
        <textarea
          value={body}
          disabled={status === 'sent'}
          onChange={(event) => setBody(event.target.value)}
          className={cn(fieldClass, 'min-h-16 flex-1 resize-none')}
        />
      </label>
      <button
        type="button"
        onClick={send}
        disabled={!canSend}
        className={cn(
          'inline-flex h-control-sm shrink-0 items-center justify-center rounded-md border px-3',
          'text-xs font-medium',
          status === 'sent' ? SOFT_COLOR.success : SOFT_COLOR.brand,
          !canSend && 'cursor-not-allowed opacity-60',
        )}
      >
        {status === 'sending'
          ? t('operation.emailAction.sending')
          : status === 'sent'
            ? t('operation.emailAction.sent')
            : t('operation.emailAction.send')}
      </button>
    </div>
  )
}

const asSeries = (item: Record<string, unknown>, index: number): Series | null => {
  const key = typeof item.key === 'string' ? item.key : ''
  if (!key) return null

  const named = isColorName(item.color) ? CHART_COLOR[item.color] : undefined

  return {
    key,
    label: typeof item.label === 'string' ? item.label : key,
    colorIndex: Number(item.colorIndex) || index,
    ...(named ? { color: named } : {}),
  }
}

export function Trend() {
  const props = useProps()
  const data = useDataset(props.text('dataKey'))

  return (
    <div className="min-h-40 flex-1">
      <TrendChart
        bare
        className="h-full"
        height="100%"
        title={props.text('title')}
        data={data}
        xKey={props.str('xKey', 'x')}
        series={props.list('series', asSeries)}
      />
    </div>
  )
}

export function Category() {
  const props = useProps()
  const data = useDataset(props.text('dataKey'))

  return (
    <div className="min-h-40 flex-1">
      <CategoryChart
        bare
        className="h-full"
        height="100%"
        title={props.text('title')}
        data={data}
        xKey={props.str('xKey', 'x')}
        series={props.list('series', asSeries)}
      />
    </div>
  )
}

export function Breakdown() {
  const props = useProps()
  const rows = (useDataset(props.text('dataKey')) ?? []) as { name: string; value: number }[]
  const sorted = [...rows].sort((a, b) => b.value - a.value)
  const total = sorted.reduce((sum, item) => sum + (Number(item.value) || 0), 0)

  return (
    <div className="min-h-40 flex-1">
      <BreakdownChart
        bare
        className="h-full"
        height="100%"
        title={props.text('title')}
        data={sorted}
        centerLabel={props.str('centerLabel', 'Total')}
        centerValue={total}
      />
    </div>
  )
}

export function StatusBadge() {
  const props = useProps()
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center rounded-full border px-2',
        'whitespace-nowrap text-2xs font-medium',
        SOFT_COLOR[colorOf(props, 'muted')],
      )}
    >
      {props.str('text', '—')}
    </span>
  )
}

export function Divider() {
  return <hr className="my-1 border-t border-line" />
}

export function KeyValues() {
  const items = useProps().list('items', (item) => {
    const label = typeof item.label === 'string' ? item.label : ''
    return label ? { label, value: String(item.value ?? '—') } : null
  })

  if (items.length === 0) return null

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      {items.map((item) => (
        <Fragment key={item.label}>
          <dt className="truncate text-fg-subtle">{item.label}</dt>
          <dd className="truncate text-right font-mono tabular text-fg">{item.value}</dd>
        </Fragment>
      ))}
    </dl>
  )
}

export function DataTable() {
  const props = useProps()
  const columns = props.list('columns', (item) => {
    const key = typeof item.key === 'string' ? item.key : ''
    return key ? { key, label: typeof item.label === 'string' ? item.label : key } : null
  })
  const inline = props.list('rows', (item) => item)
  const named = useDataset(props.text('dataKey'))
  const rows = inline.length > 0 ? inline : (named ?? [])

  if (columns.length === 0) return null

  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full text-left text-2xs">
        <thead>
          <tr className="border-b border-line">
            {columns.map((column) => (
              <th
                key={column.key}
                className="whitespace-nowrap px-2 py-1 font-medium text-fg-subtle"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-line/40 last:border-0">
              {columns.map((column) => (
                <td key={column.key} className="whitespace-nowrap px-2 py-1 text-fg">
                  {String(row[column.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Timeline() {
  const props = useProps()
  const inline = props.list('events', (item) => {
    const text = typeof item.text === 'string' ? item.text : ''
    if (!text) return null
    const raw = item.color ?? item.status
    return {
      text,
      at: typeof item.at === 'string' ? item.at : undefined,
      status: isColorName(raw) ? raw : ('subtle' as ColorName),
    }
  })

  const named = useDataset(props.text('dataKey'))
  const events =
    inline.length > 0
      ? inline
      : (named ?? []).flatMap((row) =>
          typeof row.text === 'string'
            ? [
                {
                  text: row.text,
                  at: typeof row.at === 'string' ? row.at.slice(0, 10) : undefined,
                  status: 'subtle' as ColorName,
                },
              ]
            : [],
        )

  if (events.length === 0) return null

  return (
    <ol className="flex flex-col gap-2">
      {events.map((event, index) => (
        <li key={index} className="flex gap-2">
          <span className="mt-1 flex flex-col items-center">
            <span className={cn('size-1.5 shrink-0 rounded-full', SOLID_COLOR[event.status])} />
            {index < events.length - 1 && <span className="mt-0.5 w-px flex-1 bg-line" />}
          </span>
          <span className="min-w-0 pb-1">
            <span className="block truncate text-xs text-fg">{event.text}</span>
            {event.at && <span className="block text-2xs text-fg-subtle">{event.at}</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}

export function Progress() {
  const props = useProps()
  const value = props.num('value')
  const max = props.num('max', 100)
  const label = props.text('label')

  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0

  return (
    <div className="min-w-0">
      {label && (
        <div className="mb-1 flex items-baseline justify-between gap-2 text-2xs">
          <span className="truncate text-fg-subtle">{label}</span>
          <span className="shrink-0 font-mono tabular text-fg">{Math.round(pct)}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken"
      >
        <div
          className={cn('h-full rounded-full', SOLID_COLOR[colorOf(props, 'brand')])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function Sparkline() {
  const props = useProps()
  const rows = useDataset(props.text('dataKey')) ?? []
  const valueKey = props.str('valueKey', 'value')
  const stroke = CHART_COLOR[colorOf(props, 'brand')]

  if (rows.length === 0) return null

  return (
    <div className="h-20 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <YAxis
            {...axisProps}
            width={40}
            tickCount={3}
            tickFormatter={(value) => formatNumber(Number(value))}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: cursorProps.stroke, strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey={valueKey}
            stroke={stroke}
            fill={stroke}
            fillOpacity={0.15}
            strokeWidth={1.5}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export interface VesselPositionRow {
  bookingId: string
  vessel: string
  carrier: string
  lat: number
  lng: number
}

const MapPart = lazy(() => import('./MapPart'))

export function Map() {
  return (
    <Suspense fallback={<div className="min-h-40 flex-1 animate-pulse rounded-md bg-surface-sunken" />}>
      <MapPart />
    </Suspense>
  )
}

const FILE_KINDS = {
  pdf: { icon: FileText, tone: 'text-danger', label: 'PDF' },
  word: { icon: FileType, tone: 'text-info', label: 'Word' },
  excel: { icon: FileSpreadsheet, tone: 'text-success', label: 'Excel' },
  csv: { icon: FileSpreadsheet, tone: 'text-accent', label: 'CSV' },
  powerpoint: { icon: Presentation, tone: 'text-warning', label: 'PowerPoint' },
  image: { icon: FileImage, tone: 'text-brand', label: 'Imagen' },
  archive: { icon: FileArchive, tone: 'text-fg-muted', label: 'Comprimido' },
  code: { icon: FileCode, tone: 'text-fg-muted', label: 'Datos' },
  file: { icon: File, tone: 'text-fg-subtle', label: 'Archivo' },
} as const

type FileKind = keyof typeof FILE_KINDS

const BY_EXTENSION: Record<string, FileKind> = {
  pdf: 'pdf',
  doc: 'word',
  docx: 'word',
  rtf: 'word',
  xls: 'excel',
  xlsx: 'excel',
  csv: 'csv',
  tsv: 'csv',
  ppt: 'powerpoint',
  pptx: 'powerpoint',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  webp: 'image',
  zip: 'archive',
  rar: 'archive',
  json: 'code',
  xml: 'code',
  edi: 'code',
}

function fileKindOf(explicit: string, name: string): FileKind {
  if (explicit in FILE_KINDS) return explicit as FileKind
  if (explicit in BY_EXTENSION) return BY_EXTENSION[explicit] as FileKind
  const extension = name.split('.').pop()?.toLowerCase() ?? ''
  return BY_EXTENSION[extension] ?? 'file'
}

export function FileCard() {
  const props = useProps()
  const name = props.str('name', 'Archivo')
  const kind = fileKindOf(props.str('type').toLowerCase(), name)
  const { icon: Icon, tone, label } = FILE_KINDS[kind]
  const meta = [props.text('size'), props.text('at')].filter(Boolean).join(' · ')
  const href = props.text('url')

  const inner = (
    <>
      <Icon className={cn('size-5 shrink-0', tone)} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-fg">{name}</span>
        <span className="block truncate text-2xs text-fg-subtle">{meta || label}</span>
      </span>
    </>
  )

  const shell = cn(
    'flex min-w-0 items-center gap-2 rounded-md border border-line bg-surface px-2 py-1.5',
  )

  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        shell,
        'transition-colors hover:bg-surface-hover',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
      )}
    >
      {inner}
    </a>
  ) : (
    <div className={shell}>{inner}</div>
  )
}

export function Unknown() {
  const node = useNode()

  return (
    <details className="rounded-md border border-dashed border-line-strong bg-surface-sunken p-2">
      <summary className="cursor-pointer text-2xs text-fg-muted">
        Componente desconocido: <code className="font-mono text-fg">{node.kind}</code>
      </summary>
      <pre className="mt-2 overflow-x-auto text-2xs text-fg-subtle">
        {JSON.stringify(node, null, 2)}
      </pre>
    </details>
  )
}
