import { useEffect, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/lib/cn'

interface DropdownProps {
  trigger: ReactNode
  children: ReactNode
  align?: 'start' | 'end'
  side?: 'bottom' | 'right'
  className?: string
  width?: string
}

export function Dropdown({
  trigger,
  children,
  align = 'end',
  side = 'bottom',
  className,
  width = '12rem',
}: DropdownProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.querySelector('button')?.focus()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className={cn('relative inline-block', className)}>
      <div
        ref={triggerRef}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {trigger}
      </div>

      {open && (
        <div
          role="menu"
          style={{ minWidth: width }}
          className={cn(
            'absolute z-dropdown',
            'rounded-md border border-line bg-surface-raised shadow-lg',
            'p-0.5 animate-slide-up',
            side === 'right'
              ?
                'bottom-0 left-[calc(100%+0.375rem)]'
              : cn('top-[calc(100%+0.25rem)]', align === 'end' ? 'right-0' : 'left-0'),
          )}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  )
}

interface MenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode
  destructive?: boolean
  shortcut?: string
}

export function MenuItem({
  className,
  icon,
  destructive,
  shortcut,
  children,
  ...props
}: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        'flex w-full items-center gap-2 rounded-sm px-2 py-1.5',
        'text-left text-base transition-colors duration-fast',
        'focus-visible:outline-none focus-visible:bg-surface-hover',
        'disabled:pointer-events-none disabled:opacity-50',
        '[&_svg]:size-4 [&_svg]:shrink-0',
        destructive
          ? 'text-danger hover:bg-danger-subtle'
          : 'text-fg hover:bg-surface-hover',
        className,
      )}
      {...props}
    >
      {icon}
      <span className="flex-1 truncate">{children}</span>
      {shortcut && <kbd className="text-2xs text-fg-subtle">{shortcut}</kbd>}
    </button>
  )
}

export function MenuSeparator() {
  return <div role="separator" className="my-0.5 h-px bg-line" />
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 py-1 text-2xs font-medium uppercase tracking-wide text-fg-subtle">
      {children}
    </div>
  )
}
