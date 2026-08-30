import { useQuery } from '@tanstack/react-query'
import { Outlet, useRouterState } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { api$ } from '@/api/client'
import { endpoints, queryKeys } from '@/api/endpoints'
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary'
import { Button } from '@/components/ui/Button'
import { useDisclosure, useLocalStorage } from '@/hooks'
import { operationListSchema } from '@/schemas'
import { Sidebar } from './Sidebar'

export function AppShell() {
  const { t } = useTranslation()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const mobileMenu = useDisclosure(false)

  const { data: pendingDecisions } = useQuery({
    queryKey: queryKeys.operations.list(),
    queryFn: () =>
      api$.post(endpoints.operations.search, operationListSchema, {}),
    select: (list) => list.operations.filter((o) => o.health === 'critical').length,
    // 60s y no 30: esto alimenta UN PUNTO en el menú, y el punto no necesita
    // precisión de medio minuto. En las pantallas de operaciones la lista se
    // refresca cada 15s por su cuenta —misma clave de caché, así que este
    // observador se entera gratis—; el intervalo propio existe sólo para las
    // otras pantallas, donde nadie más la está pidiendo.
    //
    // El intervalo es POR OBSERVADOR, no por clave: dos componentes mirando la
    // misma lista con intervalos distintos disparan dos series de peticiones.
    refetchInterval: 60_000,
  })

  const [collapsed, setCollapsed] = useLocalStorage('yn.sidebar.collapsed', false)

  return (
    <div className="flex min-h-dvh bg-canvas">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((value) => !value)}
        mobileOpen={mobileMenu.isOpen}
        onCloseMobile={mobileMenu.close}
        badges={{ decisions: pendingDecisions }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Abre el cajón. Va en el FLUJO y no `fixed`: flotando se montaba
            encima del título de la página, que empieza pegado arriba desde que
            se quitó la barra superior. Una fila propia cuesta 3rem y sólo en
            móvil, y no tapa nada. */}
        <div className="flex shrink-0 items-center px-4 pt-4 md:hidden">
          <Button
            variant="secondary"
            size="icon-sm"
            onClick={mobileMenu.open}
            aria-label={t('nav.openMenu')}
          >
            <Menu />
          </Button>
        </div>

        <main className="flex-1">
          <ErrorBoundary resetKey={pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
