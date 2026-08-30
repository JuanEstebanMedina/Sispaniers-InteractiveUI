import { useTranslation } from 'react-i18next'

import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { humanize } from '@/lib/format'
import {
  CONTAINER_STATES,
  OPERATION_HEALTH,
  type ContainerState,
  type OperationHealth,
} from '@/schemas'

type StatusVisual = { tone: BadgeTone; pulse?: boolean }

const STATUS_VISUALS: Record<ContainerState, StatusVisual> = {
  booking_confirmed: { tone: 'neutral' },
  // Pulsa porque está pasando ahora mismo y el estado cambia solo mientras
  // mirás la pantalla.
  in_transit: { tone: 'info', pulse: true },
  arrived_port: { tone: 'info' },
  // Ámbar: en Manifiesto es "asunto de un humano", y una retención en aduana
  // lo es siempre.
  customs: { tone: 'warning' },
  delivered: { tone: 'success' },
}

interface OperationStatusBadgeProps {
  status: string | null | undefined
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function OperationStatusBadge({ status, size = 'md', className }: OperationStatusBadgeProps) {
  const { t } = useTranslation('domain')

  const key = String(status ?? '').toLowerCase()
  const known = (CONTAINER_STATES as readonly string[]).includes(key)

  if (!known) {
    return (
      <Badge dot tone="outline" size={size} className={className}>
        {humanize(status) || t('operation.status.unknown')}
      </Badge>
    )
  }

  const visual = STATUS_VISUALS[key as ContainerState]

  return (
    <Badge dot tone={visual.tone} pulse={visual.pulse} size={size} className={className}>
      {t(`operation.status.${key}` as never)}
    </Badge>
  )
}

const HEALTH_CLASSES: Record<OperationHealth, string> = {
  on_track: 'bg-success-subtle text-success-fg border-success/30',
  at_risk: 'bg-warning-subtle text-warning-fg border-warning/30',
  critical: 'bg-danger-subtle text-danger-fg border-danger/30',
}

interface HealthChipProps {
  health: string | null | undefined
  className?: string
}

export function HealthChip({ health, className }: HealthChipProps) {
  const { t } = useTranslation('domain')

  const key = (
    (OPERATION_HEALTH as readonly string[]).includes(String(health)) ? health : 'on_track'
  ) as OperationHealth

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5',
        'text-xs font-medium whitespace-nowrap',
        HEALTH_CLASSES[key],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {t(`operation.health.${key}` as never)}
    </span>
  )
}
