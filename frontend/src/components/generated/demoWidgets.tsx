import { formatDate } from '@/lib/format'
import { WIDGET_SIZES } from '@/lib/grid'
import type { Operation } from '@/schemas'
import type { Widget } from './WidgetGrid'

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex h-full flex-col justify-center">
      <p className="truncate font-mono text-lg font-semibold tabular text-fg">{value}</p>
      <p className="mt-0.5 text-2xs text-fg-subtle">{label}</p>
    </div>
  )
}

/**
 * Stand-in for the blocks the agent will stream. Sized from the tiling
 * catalogue so the packed result has no holes.
 */
export function demoWidgets(operation: Operation): Widget[] {
  return [
    {
      id: 'containers',
      ...WIDGET_SIZES.small,
      col: 0,
      row: 2,
      title: 'Contenedores',
      body: <Stat value={String(operation.containers)} label="en la operación" />,
    },
    {
      id: 'eta',
      ...WIDGET_SIZES.small,
      col: 2,
      row: 2,
      title: 'ETA',
      fromAgent: true,
      body: <Stat value={operation.eta ? formatDate(operation.eta) : '—'} label="estimado" />,
    },
    {
      id: 'lastEvent',
      ...WIDGET_SIZES.banner,
      col: 0,
      row: 4,
      // El backend aún no expone qué agente la movió, sólo el cambio.
      title: 'Último movimiento',
      fromAgent: true,
      body: <p className="truncate text-xs text-fg-muted">{operation.lastEvent ?? '—'}</p>,
    },
    {
      id: 'timeline',
      ...WIDGET_SIZES.tall,
      col: 0,
      row: 5,
      title: 'Línea de tiempo',
      body: <p className="text-xs text-fg-subtle">Pendiente del stream del agente.</p>,
    },
    {
      id: 'health',
      ...WIDGET_SIZES.small,
      col: 2,
      row: 5,
      title: 'Salud',
      body: <Stat value={operation.health} label="de la carga" />,
    },
    {
      id: 'status',
      ...WIDGET_SIZES.small,
      col: 2,
      row: 7,
      title: 'Estado',
      body: <Stat value={operation.status} label="del flujo" />,
    },
  ]
}
