import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '@/auth/auth.store'
import { navigation } from '@/config/nav'
import { isDev } from '@/config/env'
import { cn } from '@/lib/cn'

interface SidebarNavProps {
  labelVisibility: string
  collapsed: boolean
  onNavigate: () => void
  badges: Partial<Record<'decisions' | 'notifications', number>>
}

/**
 * The menu filters by permission, so an operator simply never sees Companies —
 * not because somebody remembered to write an `if` at the call site.
 */
export function SidebarNav({ labelVisibility, collapsed, onNavigate, badges }: SidebarNavProps) {
  const { t } = useTranslation()
  const isAtLeast = useAuthStore((state) => state.isAtLeast)

  const sections = navigation
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.devOnly && !isDev) return false
        if (!item.minRole) return true
        return isAtLeast(item.minRole)
      }),
    }))
    .filter((section) => section.items.length > 0)

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-2">
      {sections.map((section, index) => (
        <div key={section.labelKey ?? index} className={cn(index > 0 && 'mt-6')}>
          {section.labelKey && (
            <p
              className={cn(
                'px-3 pb-2 text-xs font-medium uppercase tracking-wide text-fg-subtle',
                labelVisibility,
              )}
            >
              {t(`nav.sections.${section.labelKey}` as never)}
            </p>
          )}

          <ul className="space-y-1">
            {section.items.map((item) => {
              const Icon = item.icon
              const badge = item.badgeKey ? badges[item.badgeKey] : undefined
              const label = t(`nav.items.${item.labelKey}` as never)

              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    activeOptions={{ exact: item.to === '/' }}
                    onClick={onNavigate}
                    className={cn(
                      'group relative flex h-control-lg items-center gap-3 rounded-lg px-3',
                      'text-base font-medium transition-colors duration-fast',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                      'text-fg-muted hover:bg-surface-hover hover:text-fg',
                      'md:justify-center',
                      !collapsed && 'lg:justify-start',
                    )}
                    activeProps={{
                      className:
                        'bg-brand-subtle text-brand hover:bg-brand-subtle hover:text-brand',
                    }}
                    title={label}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden />

                    <span className={cn('min-w-0 flex-1 truncate', labelVisibility)}>{label}</span>

                    {badge !== undefined && badge > 0 && (
                      <span
                        className={cn(
                          'size-2 shrink-0 rounded-full bg-accent',
                          'md:absolute md:right-2 md:top-2',
                          !collapsed && 'lg:static',
                        )}
                        title={label}
                      />
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
