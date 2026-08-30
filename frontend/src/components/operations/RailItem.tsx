import { Link } from '@tanstack/react-router'

import { cn } from '@/lib/cn'
import { formatRelative } from '@/lib/format'
import type { Operation } from '@/schemas'
import { OperationStatusBadge } from './OperationStatus'

/**
 * Una fila del riel lateral.
 *
 * Versión comprimida de `OperationCard`: mismo dato, un tercio del alto. No
 * reusa la tarjeta porque en 18rem de ancho la ruta A→B y el chip de salud no
 * caben, y meter media docena de props de densidad en la tarjeta la habría
 * convertido en dos componentes disfrazados de uno.
 */

interface RailItemProps {
  operation: Operation
  active: boolean
  /** Cierra el cajón al navegar: en pantallas chicas el riel flota encima. */
  onNavigate?: () => void
}

export function RailItem({ operation, active, onNavigate }: RailItemProps) {
  const waiting = operation.status === 'needs_decision'

  return (
    <Link
      to="/operations/$trackId"
      params={{ trackId: operation.trackId }}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      className={cn(
        'block rounded-md border border-transparent px-3 py-2.5',
        'transition-colors duration-fast',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        active ? 'border-brand/40 bg-surface-active' : 'hover:bg-surface-hover',
        // El filete se ve de reojo, sin leer una palabra: es lo único que
        // funciona mientras la atención está en el detalle.
        waiting && 'border-l-2 border-l-accent',
      )}
    >
      <p className="truncate text-sm font-medium text-fg">{operation.shipper}</p>

      <p className="mt-0.5 font-mono text-xs text-fg-subtle tabular">{operation.trackId}</p>

      <div className="mt-2 flex items-center justify-between gap-2">
        <OperationStatusBadge status={operation.status} size="sm" />
        <time className="shrink-0 text-xs text-fg-subtle" dateTime={operation.updatedAt}>
          {formatRelative(operation.updatedAt)}
        </time>
      </div>
    </Link>
  )
}
