import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { env } from '@/config/env'
import { cn } from '@/lib/cn'
import { SidebarFooter } from './SidebarFooter'
import { SidebarNav } from './SidebarNav'

/**
 * SIDEBAR
 *
 * Tres formas del mismo componente según el espacio:
 *
 *   < md   cajón que entra desde la izquierda, con overlay
 *   md–lg  columna sólo de iconos
 *   ≥ lg   columna completa con etiquetas, colapsable a mano
 *
 * El cajón y la columna son el MISMO markup: mantener dos árboles separados
 * garantiza que uno de los dos se quede viejo.
 *
 * Este archivo sólo arma el armazón. La navegación vive en SidebarNav y la
 * cuenta + preferencias en SidebarFooter.
 */

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
  badges?: Partial<Record<'decisions' | 'notifications', number>>
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  badges = {},
}: SidebarProps) {
  const { t } = useTranslation()
  const labelVisibility = cn('md:hidden', !collapsed && 'lg:block')

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-sidebar bg-overlay backdrop-blur-sm md:hidden"
          onClick={onCloseMobile}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          'z-sidebar flex flex-col border-r border-line bg-surface',
          'transition-[width,transform] duration-normal ease-out-quart',

          'fixed inset-y-0 left-0 w-sidebar',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',

          'md:sticky md:top-0 md:h-dvh md:translate-x-0',
          'md:w-sidebar-collapsed',
          collapsed ? 'lg:w-sidebar-collapsed' : 'lg:w-sidebar',
        )}
        aria-label={t('nav.main')}
      >
        <div
          className={cn(
            'flex h-brandbar shrink-0 items-center gap-3 px-3',
            'md:justify-center',
            !collapsed && 'lg:justify-start',
          )}
        >
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-fg"
            aria-hidden
          >
            <span className="font-display text-base font-bold">{env.VITE_APP_NAME.charAt(0)}</span>
          </div>

          <span
            className={cn(
              'min-w-0 flex-1 truncate font-display text-md font-semibold text-fg',
              labelVisibility,
            )}
          >
            {env.VITE_APP_NAME}
          </span>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onCloseMobile}
            className="ml-auto shrink-0 md:hidden"
            aria-label={t('nav.closeMenu')}
          >
            <X />
          </Button>
        </div>

        <SidebarNav
          labelVisibility={labelVisibility}
          collapsed={collapsed}
          onNavigate={onCloseMobile}
          badges={badges}
        />

        <SidebarFooter
          collapsed={collapsed}
          labelVisibility={labelVisibility}
          onToggleCollapse={onToggleCollapse}
          onCloseMobile={onCloseMobile}
        />
      </aside>
    </>
  )
}
