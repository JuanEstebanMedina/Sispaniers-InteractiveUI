import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

import { cn } from '@/lib/cn'

export interface FilterOption {
  value: string
  label: string
}

interface FilterSelectProps {
  label: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
  className?: string
}

/**
 * A select that obeys the design system.
 *
 * A native <select> renders its list with the operating system's own widget:
 * Aqua blue highlight, system font, system radius. Nothing in the theme reaches
 * it, so on a dark canvas it flashes a light macOS menu — which is exactly what
 * it was doing here.
 *
 * Built on a listbox instead, so it takes the app's tokens like every other
 * control. Keyboard behaviour follows the ARIA listbox pattern: arrows move,
 * Home/End jump, Enter picks, Escape closes and returns focus to the trigger.
 */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
  className,
}: FilterSelectProps) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()

  const selected = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    setActive(Math.max(0, options.findIndex((option) => option.value === value)))
  }, [open, options, value])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  // Keeps the highlighted option in view when arrowing past the visible slice.
  useEffect(() => {
    if (!open) return
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  function choose(index: number) {
    const option = options[index]
    if (!option) return
    onChange(option.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault()
        setOpen(true)
      }
      return
    }

    const moves: Record<string, number> = {
      ArrowDown: active + 1,
      ArrowUp: active - 1,
      Home: 0,
      End: options.length - 1,
    }

    if (event.key in moves) {
      event.preventDefault()
      setActive(Math.min(Math.max(moves[event.key], 0), options.length - 1))
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      choose(active)
      return
    }

    if (event.key === 'Escape' || event.key === 'Tab') {
      setOpen(false)
      if (event.key === 'Escape') triggerRef.current?.focus()
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-haspopup="listbox"
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onKeyDown}
        className={cn(
          'flex h-control-sm w-full items-center justify-between gap-2 rounded-md px-2.5',
          'border border-line bg-surface text-xs text-fg transition-colors',
          'hover:bg-surface-hover',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          open && 'border-brand',
        )}
      >
        <span className="truncate">{selected?.label}</span>
        <ChevronDown
          className={cn('size-3.5 shrink-0 text-fg-subtle transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          tabIndex={-1}
          className={cn(
            'absolute z-dropdown mt-1 max-h-64 w-full min-w-max overflow-y-auto',
            'rounded-md border border-line bg-surface-raised p-1 shadow-lg',
          )}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  // Highlight follows the mouse so pointer and keyboard never
                  // show two different "current" rows at once.
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(index)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-xs px-2 py-1.5 text-left text-xs',
                    'focus-visible:outline-none',
                    index === active ? 'bg-surface-active text-fg' : 'text-fg-muted',
                  )}
                >
                  <Check
                    className={cn('size-3 shrink-0 text-brand', !isSelected && 'invisible')}
                    aria-hidden
                  />
                  <span className="truncate">{option.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
