import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { Button } from './Button'
import { Select } from './Input'

interface PaginationProps {
  page: number
  pageSize: number
  total?: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizeOptions?: number[]
  className?: string
  disabled?: boolean
}

function pageRange(current: number, totalPages: number, siblings = 1): (number | null)[] {
  const maxVisible = siblings * 2 + 5

  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const left = Math.max(current - siblings, 1)
  const right = Math.min(current + siblings, totalPages)

  const showLeftEllipsis = left > 2
  const showRightEllipsis = right < totalPages - 1

  const pages: (number | null)[] = [1]
  if (showLeftEllipsis) pages.push(null)

  for (let page = Math.max(left, 2); page <= Math.min(right, totalPages - 1); page++) {
    pages.push(page)
  }

  if (showRightEllipsis) pages.push(null)
  pages.push(totalPages)

  return pages
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  className,
  disabled = false,
}: PaginationProps) {
  const totalPages = total ? Math.max(1, Math.ceil(total / pageSize)) : null
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = total ? Math.min(page * pageSize, total) : page * pageSize

  const canPrevious = page > 1 && !disabled
  const canNext = (totalPages ? page < totalPages : true) && !disabled

  const { t } = useTranslation()

  return (
    <nav
      aria-label={t('table.pagination')}
      className={cn(
        'flex flex-col gap-3 border-t border-line px-4 py-3',
        'sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex items-center gap-4 text-sm text-fg-muted">
        {total !== undefined && (
          <span aria-live="polite" className="tabular">
            {t('table.range', {
              from: formatNumber(from),
              to: formatNumber(to),
              total: formatNumber(total),
            })}
          </span>
        )}

        {onPageSizeChange && (
          <label className="flex items-center gap-2">
            <span className="hidden sm:inline">{t('table.rowsPerPage')}</span>
            <Select
              size="sm"
              value={String(pageSize)}
              disabled={disabled}
              onChange={(event) => {
                onPageSizeChange(Number(event.target.value))
                onPageChange(1)
              }}
              className="w-auto"
              options={pageSizeOptions.map((size) => ({ value: String(size), label: String(size) }))}
            />
          </label>
        )}
      </div>

      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!canPrevious}
          onClick={() => onPageChange(page - 1)}
          aria-label={t('table.previousPage')}
        >
          <ChevronLeft />
        </Button>

        {totalPages ? (
          pageRange(page, totalPages).map((item, index) =>
            item === null ? (
              <span key={`gap-${index}`} className="px-2 text-sm text-fg-subtle" aria-hidden>
                …
              </span>
            ) : (
              <Button
                key={item}
                variant={item === page ? 'soft' : 'ghost'}
                size="icon-sm"
                disabled={disabled}
                onClick={() => onPageChange(item)}
                aria-label={t('table.page', { page: item })}
                aria-current={item === page ? 'page' : undefined}
                className="tabular"
              >
                {item}
              </Button>
            ),
          )
        ) : (
          <span className="px-3 text-sm tabular text-fg-muted">
            {t('table.page', { page })}
          </span>
        )}

        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          aria-label={t('table.nextPage')}
        >
          <ChevronRight />
        </Button>
      </div>
    </nav>
  )
}
