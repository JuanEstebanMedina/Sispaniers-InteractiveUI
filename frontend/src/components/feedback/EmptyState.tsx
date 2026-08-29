import { Inbox, SearchX } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'

interface EmptyStateProps {
  variant?: 'empty' | 'no-results'
  title?: string
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
  compact?: boolean
}

export function EmptyState({
  variant = 'empty',
  title,
  description,
  icon,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  const { t } = useTranslation()

  const defaults =
    variant === 'no-results'
      ? {
          icon: <SearchX aria-hidden />,
          title: t('states.noResults'),
          description: t('states.noResultsHint'),
        }
      : {
          icon: <Inbox aria-hidden />,
          title: t('states.empty'),
          description: t('states.emptyHint'),
        }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-3 px-4 py-8' : 'gap-4 px-gutter py-16',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-surface-hover text-fg-subtle',
          compact ? 'size-10 [&_svg]:size-5' : 'size-14 [&_svg]:size-6',
        )}
      >
        {icon ?? defaults.icon}
      </div>

      <div className="max-w-prose space-y-1">
        <p className={cn('font-semibold text-fg', compact ? 'text-base' : 'text-lg')}>
          {title ?? defaults.title}
        </p>
        <p className="text-sm text-fg-muted">{description ?? defaults.description}</p>
      </div>

      {action && <div className="mt-2 flex items-center gap-2">{action}</div>}
    </div>
  )
}
