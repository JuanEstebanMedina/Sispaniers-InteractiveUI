import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'

interface Crumb {
  label: string
  to?: string
}

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  breadcrumbs?: Crumb[]
  actions?: ReactNode
  meta?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  const { t } = useTranslation()

  return (
    <header className={cn('mb-section', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label={t('nav.breadcrumbs')} className="mb-2">
          <ol className="flex flex-wrap items-center gap-0.5 text-xs text-fg-muted">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1
              return (
                <li key={`${crumb.label}-${index}`} className="flex items-center gap-0.5">
                  {crumb.to && !isLast ? (
                    <Link
                      to={crumb.to}
                      className="rounded-xs underline-offset-2 hover:text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      className={cn(isLast && 'text-fg')}
                      aria-current={isLast ? 'page' : undefined}
                    >
                      {crumb.label}
                    </span>
                  )}
                  {!isLast && <ChevronRight className="size-3 text-fg-subtle" aria-hidden />}
                </li>
              )
            })}
          </ol>
        </nav>
      )}

      {/* La banda mide lo mismo que la cabecera del sidebar (h-brandbar) y
          centra su contenido: el título queda a la misma altura que el logo
          sin números mágicos. Si cambia la altura de la marca, se mueven los
          dos juntos. */}
      <div
        className={cn(
          'flex min-h-brandbar flex-col justify-center gap-3',
          'sm:flex-row sm:items-center sm:justify-between sm:gap-stack',
        )}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-fg">{title}</h1>
          {meta}
        </div>

        {actions && (
          <div className={cn('flex shrink-0 items-center gap-2', 'max-sm:w-full max-sm:[&>*]:flex-1')}>
            {actions}
          </div>
        )}
      </div>

      {/* Fuera de la banda: dentro descentraría el título. */}
      {description && <p className="mt-1 max-w-prose text-base text-fg-muted">{description}</p>}
    </header>
  )
}
