import type { Datasets } from './ComponentData'
import type { GeneratedComponent } from '@/schemas/component.schema'

/**
 * Stand-in for what the agent will stream.
 *
 * Written as plain data, not JSX, on purpose: these are byte-for-byte the
 * shapes `POST /operations/:id/components/test-create` accepts, so anything
 * that renders here renders from the real backend too.
 */

export const sampleDatasets: Datasets = {
  eta: [
    { x: 'Jun', days: 2 },
    { x: 'Jul', days: 4 },
    { x: 'Ago', days: 9 },
    { x: 'Sep', days: 6 },
  ],
  ports: [
    { x: 'Valparaíso', containers: 3 },
    { x: 'Callao', containers: 5 },
    { x: 'Manzanillo', containers: 2 },
  ],
  documents: [
    { name: 'Booking', value: 4 },
    { name: 'BL', value: 3 },
    { name: 'Invoice', value: 2 },
    { name: 'Arrival', value: 1 },
  ],
}

const now = new Date().toISOString()

const component = (
  id: string,
  size: GeneratedComponent['size'],
  content: GeneratedComponent['content'],
  priority: GeneratedComponent['priority'] = 'normal',
): GeneratedComponent => ({
  id,
  operation_id: 'sample',
  kind: 'container',
  size,
  priority,
  content,
  created_at: now,
})

export const sampleComponents: GeneratedComponent[] = [
  // Exercises the layout node in both directions, nested.
  component('sample-eta', 'wide', [
    { kind: 'title', order: 0, props: { text: 'Desvío de ETA' } },
    {
      kind: 'layout',
      order: 1,
      props: { direction: 'row', gap: 'md', align: 'center', justify: 'between' },
      children: [
        { kind: 'stat', order: 0, props: { value: '+9 d', label: 'contra el plan', tone: 'accent' } },
        { kind: 'stat', order: 1, props: { value: '14 sep', label: 'ETA vigente' } },
        {
          kind: 'layout',
          order: 2,
          props: { direction: 'column', gap: 'xs' },
          children: [
            { kind: 'button', order: 0, props: { label: 'Reprogramar' }, action: 'confirm' },
            { kind: 'button', order: 1, props: { label: 'Avisar' }, action: 'navigate' },
          ],
        },
      ],
    },
  ], 'critical'),

  component('sample-trend', 'tall', [
    { kind: 'title', order: 0, props: { text: 'Retraso acumulado' } },
    {
      kind: 'trend-chart',
      order: 1,
      props: { dataKey: 'eta', xKey: 'x', series: [{ key: 'days', label: 'Días' }] },
    },
  ]),

  component('sample-ports', 'tall', [
    { kind: 'title', order: 0, props: { text: 'Contenedores por puerto' } },
    {
      kind: 'category-chart',
      order: 1,
      props: { dataKey: 'ports', xKey: 'x', series: [{ key: 'containers', label: 'Contenedores' }] },
    },
  ]),

  component('sample-docs', 'small', [
    { kind: 'breakdown-chart', order: 1, props: { dataKey: 'documents' } },
    { kind: 'title', order: 0, props: { text: 'Documentos' } },
  ]),

  // `order` out of array order above, and an unknown kind here: both are
  // failure modes the renderer has to survive, so the demo shows them.
  component('sample-unknown', 'small', [
    { kind: 'label', order: 0, props: { text: 'El agente inventó un nodo:' } },
    { kind: 'gantt-chart', order: 1, props: { dataKey: 'nope' } },
  ]),
]
