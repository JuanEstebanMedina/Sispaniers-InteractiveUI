import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '@/auth/auth.store'
import { navigation } from '@/config/nav'
import { isDev } from '@/config/env'
import { cn } from '@/lib/cn'

/**
 * La lista de navegación del sidebar.
 *
 * Se filtra por permiso: cada ítem declara lo que necesita en config/nav.ts,
 * así un operador sencillamente nunca ve "Usuarios" — no porque alguien se
 * acordara de escribir un `if` acá.
 */

interface SidebarNavProps {
  /** Clases que muestran u ocultan las etiquetas según ancho y estado. */
  labelVisibility: string
  collapsed: boolean
  onNavigate: () => void
  badges: Partial<Record<'decisions' | 'notifications', number>>
}

export function SidebarNav({ labelVisibility, collapsed, onNavigate, badges }: SidebarNavProps) {
  const { t } = useTranslation()
  const canAny = useAuthStore((state) => state.canAny)

  const sections = navigation
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.devOnly && !isDev) return false
        if (!item.anyOf) return true
        return canAny(item.anyOf)
      }),
    }))
    // Una sección sin ítems visibles no puede dejar su encabezado huérfano.
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
                    // `exact` sólo en la raíz: si no, "/" queda marcada como
                    // activa en todas sus rutas hijas.
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
                    // TanStack Router pone data-status="active" en el link que
                    // coincide; estilamos desde ahí en vez de pasar una render
                    // prop, y las clases quedan legibles.
                    activeProps={{
                      className:
                        'bg-brand-subtle text-brand hover:bg-brand-subtle hover:text-brand',
                    }}
                    // El title es el tooltip cuando sólo se ven iconos.
                    title={label}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden />

                    <span className={cn('min-w-0 flex-1 truncate', labelVisibility)}>{label}</span>

                    {/* Un punto y no un número: en el menú sólo hace falta
                        saber QUE hay algo esperando. El cuánto está en la
                        pantalla a la que lleva. */}
                    {badge !== undefined && badge > 0 && (
                      <span
                        className={cn(
                          'size-2 shrink-0 rounded-full bg-accent',
                          // Colapsado se va al borde del icono: sigue avisando
                          // y no ocupa ancho.
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
