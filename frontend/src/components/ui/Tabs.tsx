import { useId, type ReactNode } from 'react'

import { cn } from '@/lib/cn'

export interface TabItem<T extends string = string> {
  value: T
  label: ReactNode
  icon?: ReactNode
  count?: number
  disabled?: boolean
}

interface TabsProps<T extends string> {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  variant?: 'underline' | 'pill'
  className?: string
  fullWidth?: boolean
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  variant = 'underline',
  className,
  fullWidth = false,
}: TabsProps<T>) {
  const baseId = useId()

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    const enabled = items.filter((item) => !item.disabled)
    const currentIndex = enabled.findIndex((item) => item.value === items[index].value)

    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % enabled.length
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + enabled.length) % enabled.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = enabled.length - 1

    if (nextIndex === null) return
    event.preventDefault()

    const next = enabled[nextIndex]
    onChange(next.value)
    document.getElementById(`${baseId}-tab-${next.value}`)?.focus()
  }

  return (
    <div
      role="tablist"
      className={cn(
        'flex items-center',
        variant === 'underline' && 'gap-6 border-b border-line',
        variant === 'pill' && 'gap-0.5 rounded-md bg-surface-sunken p-0.5',
        fullWidth && 'w-full',
        'scroll-x',
        className,
      )}
    >
      {items.map((item, index) => {
        const isActive = item.value === value

        return (
          <button
            key={item.value}
            id={`${baseId}-tab-${item.value}`}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-controls={`${baseId}-panel-${item.value}`}
            tabIndex={isActive ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'inline-flex items-center gap-2 whitespace-nowrap',
              'text-base font-medium transition-colors duration-fast',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              fullWidth && 'flex-1 justify-center',
              '[&_svg]:size-4',

              variant === 'underline' && [
                'h-control-lg border-b-2 -mb-px px-0.5',
                isActive
                  ? 'border-brand text-fg'
                  : 'border-transparent text-fg-muted hover:border-line-strong hover:text-fg',
              ],

              variant === 'pill' && [
                'h-control-sm rounded-sm px-3',
                isActive ? 'bg-surface text-fg shadow-xs' : 'text-fg-muted hover:text-fg',
              ],
            )}
          >
            {item.icon}
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-2 py-px text-2xs tabular',
                  isActive ? 'bg-brand-subtle text-brand' : 'bg-surface-active text-fg-muted',
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({
  value,
  active,
  children,
  className,
}: {
  value: string
  active: string
  children: ReactNode
  className?: string
}) {
  if (value !== active) return null

  return (
    <div role="tabpanel" className={cn('animate-fade-in', className)} tabIndex={0}>
      {children}
    </div>
  )
}
