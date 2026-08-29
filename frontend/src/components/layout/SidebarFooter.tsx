import { useNavigate } from '@tanstack/react-router'
import { Check, ChevronLeft, ChevronRight, Globe, LogOut, Moon, WifiOff } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/auth/useAuth'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dropdown, MenuItem, MenuLabel } from '@/components/ui/Dropdown'
import { env } from '@/config/env'
import { LOCALE_LABELS, SUPPORTED_LOCALES, currentLocale, setLocale } from '@/i18n'
import { cn } from '@/lib/cn'
import { useThemeStore, type ThemeMode } from '@/stores/themeStore'

/**
 * PIE DEL SIDEBAR — cuenta, preferencias y colapsar
 *
 * La barra superior se eliminó y lo suyo bajó acá.
 *
 * Idioma, tema y cerrar sesión están SIEMPRE a la vista, no detrás de un
 * desplegable: son tres cosas, no vale la pena cobrar un clic por abrirlas, y
 * escondidas hay que recordar que existen.
 *
 * Colapsado no hay ancho para "etiqueta + valor", así que las mismas tres se
 * vuelven iconos con un popover que abre hacia la derecha.
 */
export function SidebarFooter({
  collapsed,
  labelVisibility,
  onToggleCollapse,
  onCloseMobile,
}: {
  collapsed: boolean
  labelVisibility: string
  onToggleCollapse: () => void
  onCloseMobile: () => void
}) {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const mode = useThemeStore((state) => state.mode)
  const setMode = useThemeStore((state) => state.setMode)
  const locale = currentLocale()

  const [isOnline, setIsOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const handleLogout = async () => {
    onCloseMobile()
    await logout()
    await navigate({ to: '/login', search: { redirect: undefined }, replace: true })
  }

  const MODES: ThemeMode[] = ['light', 'dark', 'system']

  const iconOnly = cn('hidden md:flex', !collapsed && 'lg:hidden')

  return (
    <div className="shrink-0 border-t border-line p-3">
      {(env.VITE_USE_MOCKS || !isOnline) && (
        <div className={cn('mb-3 flex flex-wrap gap-1', collapsed && 'lg:justify-center')}>
          {!isOnline && (
            <Badge tone="danger" size="sm" dot pulse icon={<WifiOff className="size-3" />}>
              <span className={labelVisibility}>{t('states.offline')}</span>
            </Badge>
          )}
          {env.VITE_USE_MOCKS && (
            <Badge tone="warning" size="sm" title={t('states.mockTooltip')}>
              <span className={labelVisibility}>{t('states.mockData')}</span>
              <span className={iconOnly}>{t('states.mock')}</span>
            </Badge>
          )}
        </div>
      )}

      <div
        className={cn(
          'flex items-center gap-3 px-1.5 py-1',
          'md:justify-center',
          !collapsed && 'lg:justify-start',
        )}
      >
        <Avatar name={user?.name} src={user?.avatarUrl} size="sm" />
        <span className={cn('min-w-0 flex-1', labelVisibility)}>
          <span className="block truncate text-sm font-medium text-fg">{user?.name}</span>
          <span className="block truncate text-xs text-fg-subtle">{user?.email}</span>
        </span>
      </div>

      <div
        className={cn(
          'mt-2 space-y-0.5 rounded-lg border border-line bg-surface-sunken p-1.5',
          labelVisibility,
        )}
      >
        <PreferenceRow
          icon={<Globe className="size-4" aria-hidden />}
          label={t('language.label')}
          value={LOCALE_LABELS[locale]}
          options={SUPPORTED_LOCALES.map((code) => ({
            id: code,
            label: LOCALE_LABELS[code],
            active: locale === code,
            onSelect: () => setLocale(code),
          }))}
        />

        <PreferenceRow
          icon={<Moon className="size-4" aria-hidden />}
          label={t('theme.theme')}
          value={t(`theme.${mode}`)}
          options={MODES.map((option) => ({
            id: option,
            label: t(`theme.${option}`),
            active: mode === option,
            onSelect: () => setMode(option),
          }))}
        />

        <div className="my-1 border-t border-line" />

        <button
          type="button"
          onClick={() => void handleLogout()}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-2.5 py-2',
            'text-sm font-medium text-danger transition-colors',
            'hover:bg-danger-subtle',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          )}
        >
          <LogOut className="size-4 shrink-0" aria-hidden />
          {t('auth:session.logout')}
        </button>
      </div>

      <div className={cn('mt-2 flex-col items-center gap-1', iconOnly)}>
        <CollapsedPicker
          icon={<Globe />}
          label={t('language.label')}
          value={LOCALE_LABELS[locale]}
          options={SUPPORTED_LOCALES.map((code) => ({
            id: code,
            label: LOCALE_LABELS[code],
            active: locale === code,
            onSelect: () => setLocale(code),
          }))}
        />

        <CollapsedPicker
          icon={<Moon />}
          label={t('theme.theme')}
          value={t(`theme.${mode}`)}
          options={MODES.map((option) => ({
            id: option,
            label: t(`theme.${option}`),
            active: mode === option,
            onSelect: () => setMode(option),
          }))}
        />

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void handleLogout()}
          className="text-danger hover:bg-danger-subtle hover:text-danger"
          aria-label={t('auth:session.logout')}
          title={t('auth:session.logout')}
        >
          <LogOut />
        </Button>
      </div>

      <div
        className={cn(
          'mt-2 hidden border-t border-line pt-2 lg:flex',
          collapsed ? 'justify-center' : 'justify-end',
        )}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleCollapse}
          aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
          title={collapsed ? t('nav.expand') : t('nav.collapse')}
        >
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </Button>
      </div>
    </div>
  )
}

function PreferenceRow({
  icon,
  label,
  value,
  options,
}: {
  icon: ReactNode
  label: string
  value: string
  options: { id: string; label: string; active: boolean; onSelect: () => void }[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-3 rounded-md px-2.5 py-2',
          'text-sm text-fg transition-colors hover:bg-surface-hover',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        )}
      >
        <span className="shrink-0 text-fg-muted">{icon}</span>
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        <span className="shrink-0 truncate text-xs text-fg-muted">{value}</span>
        <ChevronRight
          className={cn(
            'size-4 shrink-0 text-fg-subtle transition-transform duration-fast',
            open && 'rotate-90',
          )}
          aria-hidden
        />
      </button>

      {open && (
        <ul className="mb-1 ml-7 space-y-0.5">
          {options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => {
                  option.onSelect()
                  // Se cierra al elegir: dejar la lista abierta hace que la
                  // siguiente fila quede empujada hacia abajo y obliga a un
                  // clic extra sólo para volver a ver el pie completo.
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5',
                  'text-sm transition-colors hover:bg-surface-hover',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  option.active ? 'text-brand' : 'text-fg-muted',
                )}
              >
                <span className="min-w-0 flex-1 truncate text-left">{option.label}</span>
                {option.active && <Check className="size-3.5 shrink-0" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Selector del sidebar colapsado: un popover que abre hacia la derecha.
 *
 * Antes estos iconos CICLABAN entre sus valores. Con tres opciones eso obliga
 * a pasar por la del medio para llegar a la tercera —y a mirar el tooltip para
 * saber dónde quedaste—, así que un popover con las tres a la vista cuesta los
 * mismos clics y no hace adivinar.
 *
 * Abre hacia la derecha y anclado abajo porque el trigger vive en el pie de
 * una columna de 68px: hacia abajo se saldría de la pantalla.
 */
function CollapsedPicker({
  icon,
  label,
  value,
  options,
}: {
  icon: ReactNode
  label: string
  value: string
  options: { id: string; label: string; active: boolean; onSelect: () => void }[]
}) {
  return (
    <Dropdown
      side="right"
      width="11rem"
      trigger={
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`${label}: ${value}`}
          title={`${label} \u00b7 ${value}`}
        >
          {icon}
        </Button>
      }
    >
      <MenuLabel>{label}</MenuLabel>
      {options.map((option) => (
        <MenuItem
          key={option.id}
          onClick={option.onSelect}
          icon={
            option.active ? (
              <Check className="text-brand" />
            ) : (
              <span className="size-4" aria-hidden />
            )
          }
        >
          {option.label}
        </MenuItem>
      ))}
    </Dropdown>
  )
}
