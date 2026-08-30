import type { LogisticsDocument, Operation } from '@/schemas'

import { formatCalendarDate, humanize } from './format'

/**
 * Hoja de demostración para cuando el archivo real no está en el bucket.
 *
 * Sólo entra si el archivo real falló y sólo en modo demo, y se anuncia como
 * simulada. Los valores salen de la operación y de `extractedData`; lo único
 * fabricado es la maquetación.
 */

/** Los campos que dan contexto a cualquier documento de una operación. */
function contextRows(operation: Operation, document: LogisticsDocument) {
  const booking = document.bookingId
    ? operation.bookings.find((current) => current.id === document.bookingId)
    : operation.bookings[0]

  return [
    ['Operación', operation.trackId],
    ['Cliente', operation.shipper],
    ['Recibido', formatCalendarDate(document.receivedAt)],
    ...(booking
      ? ([
          ['Reserva', booking.id],
          ['Transportista', booking.carrier],
          ['Buque', booking.vessel],
          ['Origen', booking.originPort],
          ['Destino', booking.destinationPort],
          ['ETA vigente', formatCalendarDate(booking.schedule.etaCurrent)],
        ] as [string, string][])
      : []),
  ] satisfies [string, string][]
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function rows(pairs: [string, string][]): string {
  return pairs
    .map(
      ([label, value]) => `
        <div class="row">
          <dt>${escapeHtml(label)}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>`,
    )
    .join('')
}

/** Contenedores del booking al que pertenece el documento, si los hay. */
function containerRows(operation: Operation, document: LogisticsDocument): string {
  const booking = document.bookingId
    ? operation.bookings.find((current) => current.id === document.bookingId)
    : operation.bookings[0]

  const containers = booking?.containers ?? []
  if (containers.length === 0) return ''

  return `
    <section>
      <h2>Contenedores</h2>
      <table>
        <thead><tr><th>Número</th><th>Estado</th></tr></thead>
        <tbody>
          ${containers
            .map(
              (container) => `
            <tr>
              <td class="mono">${escapeHtml(container.containerNumber)}</td>
              <td>${escapeHtml(humanize(container.state))}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </section>`
}

const TYPE_LABELS: Record<string, string> = {
  PO: 'Orden de compra',
  BookingConfirmation: 'Confirmación de reserva',
  BillOfLading: 'Conocimiento de embarque',
  Invoice: 'Factura comercial',
  PackingList: 'Lista de empaque',
  ArrivalNotice: 'Aviso de llegada',
}

export function buildDocumentPreview(
  operation: Operation,
  document: LogisticsDocument,
): { title: string; html: string } {
  const label = TYPE_LABELS[document.type] ?? humanize(document.type)
  const title = `${label} · ${operation.trackId} (demo)`

  const extracted = Object.entries(document.extractedData).map(
    ([key, value]) => [humanize(key), String(value)] as [string, string],
  )

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root {
    --ink: #1c1917;
    --muted: #57534e;
    --faint: #a8a29e;
    --line: #e7e5e4;
    --paper: #ffffff;
    --ground: #efece4;
    --flag: #9f1239;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 2rem 1rem 4rem;
    background: var(--ground);
    color: var(--ink);
    font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  .sheet {
    max-width: 46rem;
    margin: 0 auto;
    background: var(--paper);
    border: 1px solid var(--line);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.06);
  }
  .flag {
    display: flex;
    align-items: center;
    gap: .5rem;
    padding: .625rem 2rem;
    background: var(--flag);
    color: #fff;
    font-size: .75rem;
    font-weight: 600;
    letter-spacing: .04em;
    text-transform: uppercase;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1.5rem;
    padding: 2rem;
    border-bottom: 2px solid var(--ink);
  }
  h1 { margin: 0; font-size: 1.375rem; letter-spacing: -0.01em; }
  .kicker {
    margin: 0 0 .25rem;
    font-size: .6875rem;
    font-weight: 600;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--faint);
  }
  .docid {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: .75rem;
    color: var(--muted);
    text-align: right;
    white-space: nowrap;
  }
  section { padding: 1.5rem 2rem; border-bottom: 1px solid var(--line); }
  section:last-of-type { border-bottom: 0; }
  h2 {
    margin: 0 0 .875rem;
    font-size: .6875rem;
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--faint);
  }
  dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem 2rem; margin: 0; }
  .row { display: flex; flex-direction: column; gap: .125rem; min-width: 0; }
  dt { font-size: .75rem; color: var(--muted); }
  dd { margin: 0; font-size: .9375rem; font-weight: 500; overflow-wrap: anywhere; }
  table { width: 100%; border-collapse: collapse; font-size: .875rem; }
  th {
    text-align: left;
    padding: .375rem .5rem .375rem 0;
    border-bottom: 1px solid var(--line);
    font-size: .6875rem;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: var(--faint);
  }
  td { padding: .5rem .5rem .5rem 0; border-bottom: 1px solid var(--line); }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  footer { padding: 1.25rem 2rem 2rem; font-size: .75rem; color: var(--faint); }
  @media (max-width: 34rem) {
    body { padding: 0 0 2rem; }
    header, section, footer, .flag { padding-left: 1.25rem; padding-right: 1.25rem; }
    dl { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
  <article class="sheet">
    <p class="flag">Documento simulado · el archivo real no está en el bucket</p>

    <header>
      <div>
        <p class="kicker">${escapeHtml(operation.shipper)}</p>
        <h1>${escapeHtml(label)}</h1>
      </div>
      <div class="docid">
        ${escapeHtml(document.id)}<br>
        ${escapeHtml(document.format.toUpperCase())}
      </div>
    </header>

    <section>
      <h2>Datos de la operación</h2>
      <dl>${rows(contextRows(operation, document))}</dl>
    </section>

    ${
      extracted.length > 0
        ? `<section>
      <h2>Datos extraídos por el agente</h2>
      <dl>${rows(extracted)}</dl>
    </section>`
        : ''
    }

    ${containerRows(operation, document)}

    <footer>
      Esta hoja la genera la consola con los metadatos que el backend sí tiene.
      Cuando el archivo esté en el bucket, este botón abrirá el original.
    </footer>
  </article>
</body>
</html>`

  return { title, html }
}
