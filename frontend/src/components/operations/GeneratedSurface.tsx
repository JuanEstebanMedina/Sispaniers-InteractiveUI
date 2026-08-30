import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'

interface GeneratedSurfaceProps {
  children?: ReactNode
  className?: string
}

/**
 * Mount point for the interface the agent writes.
 *
 * Bounded to the viewport and scrolled internally: what the agent generates has
 * no ceiling, and letting the page grow instead would carry the rail's sticky
 * column out of reach.
 */
export function GeneratedSurface({ children, className }: GeneratedSurfaceProps) {
  const { t } = useTranslation('domain')

  return (
    <section
      // A little padding so the widgets' shadows are not clipped by the scroll box.
      className={cn('min-h-0 overflow-auto p-1', className)}
      aria-label={t('operation.generated.label')}
    >
      {children ?? (
        <div className="flex h-full min-h-72 flex-col items-center justify-center gap-2 text-center">
          <p className="text-base font-medium text-fg-muted">
            {t('operation.generated.emptyTitle')}
          </p>
          <p className="max-w-prose text-sm text-fg-subtle">
            {t('operation.generated.emptyHint')}
          </p>
        </div>
      )}
    </section>
  )
}
