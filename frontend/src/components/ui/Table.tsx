import {
  columnVisibilityFeature,
  createColumnHelper,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { cn } from '@/lib/cn'
import { SkeletonTable } from './Skeleton'
import { Checkbox } from './Toggle'

export const tableFeatureSet = tableFeatures({
  rowSortingFeature,
  rowSelectionFeature,
  columnVisibilityFeature,
})

export type AppTableFeatures = typeof tableFeatureSet

export function columnHelperFor<TData extends RowData>() {
  return createColumnHelper<AppTableFeatures, TData>()
}

export interface ColumnMeta {
  align?: 'left' | 'center' | 'right'
  numeric?: boolean
  hideBelow?: 'sm' | 'md' | 'lg'
  primary?: boolean
  width?: string | number
}

interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  stickyHeader?: boolean
}

export function Table({ className, stickyHeader, ...props }: TableProps) {
  return (
    <div className="scroll-x w-full">
      <table
        className={cn('w-full border-collapse text-left text-base', className)}
        data-sticky={stickyHeader || undefined}
        {...props}
      />
    </div>
  )
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        'bg-surface-sunken text-fg-muted',
        '[table[data-sticky]_&]:sticky [table[data-sticky]_&]:top-0 [table[data-sticky]_&]:z-raised',
        className,
      )}
      {...props}
    />
  )
}

export function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-line-subtle', className)} {...props} />
}

interface TrProps extends React.HTMLAttributes<HTMLTableRowElement> {
  interactive?: boolean
  selected?: boolean
}

export function Tr({ className, interactive, selected, ...props }: TrProps) {
  return (
    <tr
      className={cn(
        'transition-colors duration-fast',
        interactive &&
          'cursor-pointer pointer-fine:hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none',
        selected && 'bg-brand-muted',
        className,
      )}
      tabIndex={interactive ? 0 : undefined}
      {...props}
    />
  )
}

interface ThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'center' | 'right'
  width?: string | number
}

export function Th({ className, align = 'left', width, style, ...props }: ThProps) {
  return (
    <th
      scope="col"
      style={{ width, ...style }}
      className={cn(
        'h-row-dense px-4 text-xs font-medium uppercase tracking-wide',
        'whitespace-nowrap border-b border-line',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
      {...props}
    />
  )
}

interface TdProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'center' | 'right'
  numeric?: boolean
}

export function Td({ className, align, numeric, ...props }: TdProps) {
  const alignment = align ?? (numeric ? 'right' : 'left')

  return (
    <td
      className={cn(
        'h-row px-4 align-middle text-base text-fg',
        'dense:h-row-dense dense:py-2',
        alignment === 'right' && 'text-right',
        alignment === 'center' && 'text-center',
        numeric && 'tabular',
        className,
      )}
      {...props}
    />
  )
}

const HIDE_CLASS = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
} as const

interface DataTableProps<TData extends RowData> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<AppTableFeatures, TData, any>[]
  rows: TData[] | undefined
  getRowId: (row: TData) => string

  isLoading?: boolean
  error?: unknown
  onRetry?: () => void

  sorting?: SortingState
  onSortingChange?: (sorting: SortingState) => void

  onRowClick?: (row: TData) => void
  selectedId?: string | null

  enableSelection?: boolean
  selectedRowIds?: RowSelectionState
  onSelectionChange?: (selection: RowSelectionState) => void

  hasFilters?: boolean
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: ReactNode

  stickyHeader?: boolean
  className?: string
  cardBreakpoint?: 'sm' | 'md'
}

export function DataTable<TData extends RowData>({
  columns,
  rows,
  getRowId,
  isLoading,
  error,
  onRetry,
  sorting = [],
  onSortingChange,
  onRowClick,
  selectedId,
  enableSelection = false,
  selectedRowIds,
  onSelectionChange,
  hasFilters = false,
  emptyTitle,
  emptyDescription,
  emptyAction,
  stickyHeader = true,
  className,
  cardBreakpoint = 'md',
}: DataTableProps<TData>) {
  const { t } = useTranslation()
  const data = rows ?? []

  const table = useTable({
    features: tableFeatureSet,
    columns,
    data,
    getRowId,

    manualSorting: true,

    state: {
      sorting,
      ...(enableSelection ? { rowSelection: selectedRowIds ?? {} } : {}),
    },

    onSortingChange: (updater) => {
      if (!onSortingChange) return
      const next = typeof updater === 'function' ? updater(sorting) : updater
      onSortingChange(next)
    },

    onRowSelectionChange: (updater) => {
      if (!onSelectionChange) return
      const next = typeof updater === 'function' ? updater(selectedRowIds ?? {}) : updater
      onSelectionChange(next)
    },

    enableRowSelection: enableSelection,
    enableSortingRemoval: false,
  })

  if (error) {
    return (
      <div className={className}>
        <ErrorState error={error} onRetry={onRetry} />
      </div>
    )
  }

  if (isLoading && !rows) {
    return (
      <div className={className}>
        <SkeletonTable columns={columns.length} rows={6} />
      </div>
    )
  }

  if (rows && rows.length === 0) {
    return (
      <div className={className}>
        <EmptyState
          variant={hasFilters ? 'no-results' : 'empty'}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    )
  }

  const cardHiddenAt = cardBreakpoint === 'sm' ? 'max-sm:hidden' : 'max-md:hidden'
  const cardVisibleAt = cardBreakpoint === 'sm' ? 'sm:hidden' : 'md:hidden'

  const metaOf = (columnDef: { meta?: unknown }): ColumnMeta => (columnDef.meta ?? {}) as ColumnMeta

  return (
    <div className={cn('relative', className)}>
      {isLoading && data.length > 0 && (
        <div className="absolute inset-x-0 top-0 z-raised h-0.5 overflow-hidden bg-brand-subtle">
          <div className="h-full w-1/3 animate-[shimmer_1.2s_ease-in-out_infinite] bg-brand" />
        </div>
      )}

      {enableSelection && table.getSelectedRowModel().rows.length > 0 && (
        <div className="flex items-center gap-3 border-b border-line bg-brand-muted px-4 py-2 text-sm">
          <span className="text-fg">
            {t('table.selectedCount', { count: table.getSelectedRowModel().rows.length })}
          </span>
        </div>
      )}

      <div className={cardHiddenAt}>
        <Table stickyHeader={stickyHeader}>
          <THead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {enableSelection && (
                  <Th width="2.5rem">
                    <Checkbox
                      checked={table.getIsAllRowsSelected()}
                      indeterminate={table.getIsSomeRowsSelected()}
                      onChange={table.getToggleAllRowsSelectedHandler()}
                      aria-label={t('table.selectAll')}
                    />
                  </Th>
                )}

                {headerGroup.headers.map((header) => {
                  const meta = metaOf(header.column.columnDef)
                  const canSort = header.column.getCanSort()
                  const direction = header.column.getIsSorted()

                  const SortIcon = !direction
                    ? ChevronsUpDown
                    : direction === 'asc'
                      ? ArrowUp
                      : ArrowDown

                  return (
                    <Th
                      key={header.id}
                      align={meta.align ?? (meta.numeric ? 'right' : 'left')}
                      width={meta.width}
                      className={meta.hideBelow ? HIDE_CLASS[meta.hideBelow] : undefined}
                      aria-sort={
                        direction === 'asc'
                          ? 'ascending'
                          : direction === 'desc'
                            ? 'descending'
                            : canSort
                              ? 'none'
                              : undefined
                      }
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-xs transition-colors',
                            'hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                            direction && 'text-fg',
                            meta.align === 'right' && 'flex-row-reverse',
                          )}
                          aria-label={
                            direction === 'asc' ? t('table.sortDescending') : t('table.sortAscending')
                          }
                        >
                          <table.FlexRender header={header} />
                          <SortIcon className="size-3" aria-hidden />
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </Th>
                  )
                })}
              </tr>
            ))}
          </THead>

          <TBody>
            {table.getRowModel().rows.map((row) => (
              <Tr
                key={row.id}
                interactive={Boolean(onRowClick)}
                selected={selectedId === row.id || row.getIsSelected()}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onRowClick(row.original)
                        }
                      }
                    : undefined
                }
              >
                {enableSelection && (
                  <Td
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Checkbox
                      checked={row.getIsSelected()}
                      disabled={!row.getCanSelect()}
                      onChange={row.getToggleSelectedHandler()}
                      aria-label={t('table.selectRow')}
                    />
                  </Td>
                )}

                {row.getAllCells().map((cell) => {
                  const meta = metaOf(cell.column.columnDef)
                  return (
                    <Td
                      key={cell.id}
                      align={meta.align}
                      numeric={meta.numeric}
                      className={meta.hideBelow ? HIDE_CLASS[meta.hideBelow] : undefined}
                    >
                      <table.FlexRender cell={cell} />
                    </Td>
                  )
                })}
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>

      <ul className={cn('divide-y divide-line-subtle', cardVisibleAt)}>
        {table.getRowModel().rows.map((row) => {
          const cells = row.getAllCells()
          const primaryCell = cells.find((cell) => metaOf(cell.column.columnDef).primary) ?? cells[0]
          const rest = cells.filter((cell) => cell !== primaryCell)

          return (
            <li key={row.id}>
              <div
                className={cn(
                  'flex flex-col gap-2 p-4',
                  onRowClick && 'cursor-pointer active:bg-surface-hover',
                  selectedId === row.id && 'bg-brand-muted',
                )}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                role={onRowClick ? 'button' : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onRowClick(row.original)
                        }
                      }
                    : undefined
                }
              >
                <div className="font-medium text-fg">
                  <table.FlexRender cell={primaryCell} />
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {rest.map((cell) => (
                    <div key={cell.id} className="min-w-0">
                      <dt className="text-2xs uppercase tracking-wide text-fg-subtle">
                        <table.FlexRender header={cell.column.columnDef.header as never} />
                      </dt>
                      <dd
                        className={cn(
                          'truncate text-sm text-fg',
                          metaOf(cell.column.columnDef).numeric && 'tabular',
                        )}
                      >
                        <table.FlexRender cell={cell} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
