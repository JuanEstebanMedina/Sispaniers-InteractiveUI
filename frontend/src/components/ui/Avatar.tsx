import { useState } from 'react'

import { cn } from '@/lib/cn'
import { initials } from '@/lib/format'

const PALETTE = [
  'bg-chart-1/15 text-chart-1',
  'bg-chart-2/15 text-chart-2',
  'bg-chart-3/15 text-chart-3',
  'bg-chart-4/15 text-chart-4',
  'bg-chart-5/15 text-chart-5',
  'bg-chart-6/15 text-chart-6',
  'bg-chart-7/15 text-chart-7',
  'bg-chart-8/15 text-chart-8',
] as const

function colorFor(seed: string): string {
  let hash = 5381
  for (let i = 0; i < seed.length; i++) hash = (hash * 33) ^ seed.charCodeAt(i)
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

const SIZES = {
  xs: 'size-6 text-2xs',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-md',
  xl: 'size-16 text-xl',
} as const

interface AvatarProps {
  name?: string | null
  src?: string | null
  size?: keyof typeof SIZES
  className?: string
  status?: 'online' | 'offline' | 'busy'
}

export function Avatar({ name, src, size = 'md', className, status }: AvatarProps) {
  const [failed, setFailed] = useState(false)
  const label = name ?? '—'
  const showImage = src && !failed

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span
        className={cn(
          'inline-flex items-center justify-center overflow-hidden rounded-full',
          'font-semibold select-none',
          SIZES[size],
          !showImage && colorFor(label),
        )}
        title={label}
      >
        {showImage ? (
          <img
            src={src}
            alt={label}
            onError={() => setFailed(true)}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <span aria-hidden>{initials(label)}</span>
        )}
      </span>

      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full ring-2 ring-surface',
            size === 'xs' || size === 'sm' ? 'size-2' : 'size-2.5',
            status === 'online' && 'bg-success',
            status === 'busy' && 'bg-warning',
            status === 'offline' && 'bg-fg-subtle',
          )}
          aria-label={status}
        />
      )}
    </span>
  )
}

export function AvatarGroup({
  people,
  max = 4,
  size = 'sm',
}: {
  people: { name: string; src?: string | null }[]
  max?: number
  size?: keyof typeof SIZES
}) {
  const visible = people.slice(0, max)
  const overflow = people.length - visible.length

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((person, index) => (
        <Avatar
          key={`${person.name}-${index}`}
          name={person.name}
          src={person.src}
          size={size}
          className="ring-2 ring-surface rounded-full"
        />
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full',
            'bg-surface-active text-fg-muted font-medium ring-2 ring-surface',
            SIZES[size],
          )}
          title={people.slice(max).map((person) => person.name).join(', ')}
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}
