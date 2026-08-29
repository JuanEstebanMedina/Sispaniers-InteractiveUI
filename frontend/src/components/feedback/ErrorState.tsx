import { AlertTriangle, FileWarning, Lock, RefreshCw, SearchX, ServerCrash, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { normalizeError, type ErrorKind } from '@/api/errors'
import { Button } from '@/components/ui/Button'
import { isDev } from '@/config/env'
import { cn } from '@/lib/cn'

const ICONS: Record<ErrorKind, ReactNode> = {
  network: <WifiOff aria-hidden />,
  timeout: <RefreshCw aria-hidden />,
  server: <ServerCrash aria-hidden />,
  rateLimit: <AlertTriangle aria-hidden />,
  forbidden: <Lock aria-hidden />,
  unauthorized: <Lock aria-hidden />,
  notFound: <SearchX aria-hidden />,
  validation: <AlertTriangle aria-hidden />,
  conflict: <AlertTriangle aria-hidden />,
  canceled: <AlertTriangle aria-hidden />,
  parse: <FileWarning aria-hidden />,
  unknown: <AlertTriangle aria-hidden />,
}

interface ErrorStateProps {
  error: unknown
  onRetry?: () => void
  action?: ReactNode
  className?: string
  compact?: boolean
}

export function ErrorState({ error, onRetry, action, className, compact = false }: ErrorStateProps) {
  const { t } = useTranslation()
  const apiError = normalizeError(error)

  const showRetry = apiError.isRetryable && Boolean(onRetry)

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-3 px-4 py-8' : 'gap-4 px-gutter py-16',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-danger-subtle text-danger',
          compact ? 'size-10 [&_svg]:size-5' : 'size-14 [&_svg]:size-6',
        )}
      >
        {ICONS[apiError.kind]}
      </div>

      <div className="max-w-prose space-y-1">
        <p className={cn('font-semibold text-fg', compact ? 'text-base' : 'text-lg')}>
          {apiError.title}
        </p>
        <p className="text-sm text-fg-muted">{apiError.message}</p>

        {apiError.traceId && (
          <p className="data-mono select-all text-2xs text-fg-subtle">
            {t('errors:reference', { traceId: apiError.traceId })}
          </p>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        {showRetry && (
          <Button variant="secondary" size="sm" icon={<RefreshCw />} onClick={onRetry}>
            {t('actions.retry')}
          </Button>
        )}
        {action}
      </div>

      {isDev && apiError.cause instanceof Error && (
        <details className="mt-3 w-full max-w-2xl text-left">
          <summary className="cursor-pointer text-2xs text-fg-subtle hover:text-fg-muted">
            {t('errors:technicalDetail')}
          </summary>
          <pre className="scroll-x mt-2 rounded-md bg-surface-sunken p-3 text-2xs text-fg-muted">
            {apiError.cause.stack ?? apiError.cause.message}
          </pre>
        </details>
      )}
    </div>
  )
}
