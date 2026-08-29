import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function FullPageLoader({ label }: { label?: string }) {
  const { t } = useTranslation()

  return (
    <div
      className="flex min-h-dvh w-full flex-col items-center justify-center gap-4 bg-canvas"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-6 animate-spin text-brand" aria-hidden />
      <p className="text-sm text-fg-muted">{label ?? t('states.loading')}</p>
    </div>
  )
}
