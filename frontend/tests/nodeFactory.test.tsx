import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import { ComponentDataProvider } from '@/components/generated/ComponentData'
import { createTree } from '@/components/generated/nodeFactory'
import { sampleComponents, sampleDatasets } from '@/components/generated/sampleComponents'
import type { ComponentNode } from '@/schemas/component.schema'

/**
 * Rendered to static markup rather than through a DOM: the factory's job is to
 * turn a node tree into the right elements, and that is fully visible in the
 * output string. No jsdom needed.
 */
function render(nodes: ComponentNode[]): string {
  return renderToStaticMarkup(
    <ComponentDataProvider datasets={sampleDatasets}>{createTree(nodes)}</ComponentDataProvider>,
  )
}

describe('node ordering', () => {
  test('order decides the sequence, not the position in the array', () => {
    const html = render([
      { kind: 'title', order: 1, props: { text: 'SEGUNDO' } },
      { kind: 'title', order: 0, props: { text: 'PRIMERO' } },
    ])

    expect(html.indexOf('PRIMERO')).toBeLessThan(html.indexOf('SEGUNDO'))
  })
})

describe('unknown kinds', () => {
  test('an invented kind renders a placeholder instead of throwing', () => {
    const html = render([{ kind: 'gantt-chart', order: 0, props: {} }])

    expect(html).toContain('gantt-chart')
  })

  test('one unknown node does not take the rest of the tree with it', () => {
    const html = render([
      { kind: 'gantt-chart', order: 0, props: {} },
      { kind: 'title', order: 1, props: { text: 'SOBREVIVE' } },
    ])

    expect(html).toContain('SOBREVIVE')
  })
})

describe('layout', () => {
  test('direction maps to the flex axis', () => {
    expect(render([{ kind: 'layout', order: 0, props: { direction: 'row' }, children: [] }])).toContain(
      'flex-row',
    )
    expect(
      render([{ kind: 'layout', order: 0, props: { direction: 'column' }, children: [] }]),
    ).toContain('flex-col')
  })

  test('a direction outside the contract falls back to column', () => {
    const html = render([
      { kind: 'layout', order: 0, props: { direction: 'diagonal' }, children: [] },
    ])

    expect(html).toContain('flex-col')
  })

  test('renders children of any kind, nested', () => {
    const html = render([
      {
        kind: 'layout',
        order: 0,
        props: { direction: 'row' },
        children: [
          {
            kind: 'layout',
            order: 0,
            props: { direction: 'column' },
            children: [{ kind: 'stat', order: 0, props: { value: 'ANIDADO' } }],
          },
        ],
      },
    ])

    expect(html).toContain('ANIDADO')
  })
})

describe('the design system holds against whatever the agent sends', () => {
  test('a raw spacing value never reaches the DOM', () => {
    const html = render([{ kind: 'layout', order: 0, props: { gap: '37px' }, children: [] }])

    expect(html).not.toContain('37px')
    expect(html).toContain('gap-2')
  })

  test('an off-palette tone falls back to a token', () => {
    const html = render([
      { kind: 'title', order: 0, props: { text: 'X', tone: 'hotpink' } },
    ])

    expect(html).not.toContain('hotpink')
    expect(html).toContain('text-fg')
  })
})

describe('malformed props degrade instead of crashing', () => {
  test('a stat whose value is not a string shows a dash', () => {
    expect(render([{ kind: 'stat', order: 0, props: { value: 42 } }])).toContain('—')
  })

  test('a button with no label still renders', () => {
    expect(
      render([{ kind: 'button', order: 0, props: {}, action: 'confirm' }]),
    ).toContain('Acción')
  })
})

describe('the sample trees', () => {
  test('every one renders', () => {
    for (const component of sampleComponents) {
      expect(() => render(component.content)).not.toThrow()
    }
  })
})

describe('the added data shapes', () => {
  test('a timeline renders every event with its date', () => {
    const html = render([
      {
        kind: 'timeline',
        order: 0,
        props: {
          events: [
            { text: 'Booking confirmado', at: '2 sep', status: 'success' },
            { text: 'Transbordo no previsto', at: '9 sep', status: 'danger' },
          ],
        },
      },
    ])

    expect(html).toContain('Booking confirmado')
    expect(html).toContain('Transbordo no previsto')
    expect(html).toContain('9 sep')
  })

  test('a table renders the declared columns and nothing else', () => {
    const html = render([
      {
        kind: 'table',
        order: 0,
        props: {
          columns: [{ key: 'id', label: 'Contenedor' }],
          rows: [{ id: 'MSCU7741820', oculto: 'NO_DEBE_SALIR' }],
        },
      },
    ])

    expect(html).toContain('MSCU7741820')
    expect(html).not.toContain('NO_DEBE_SALIR')
  })

  test('a table cell with no value shows a dash rather than "undefined"', () => {
    const html = render([
      {
        kind: 'table',
        order: 0,
        props: { columns: [{ key: 'eta', label: 'ETA' }], rows: [{}] },
      },
    ])

    expect(html).toContain('—')
    expect(html).not.toContain('undefined')
  })

  test('key-values drops a pair with no label instead of rendering a blank row', () => {
    const html = render([
      {
        kind: 'key-values',
        order: 0,
        props: { items: [{ label: 'Naviera', value: 'MSC' }, { value: 'huérfano' }] },
      },
    ])

    expect(html).toContain('MSC')
    expect(html).not.toContain('huérfano')
  })

  test('progress clamps a value past its target', () => {
    const html = render([
      { kind: 'progress', order: 0, props: { value: 900, max: 100, label: 'Días' } },
    ])

    expect(html).toContain('width:100%')
    expect(html).not.toContain('900%')
  })

  test('progress survives a max of zero without dividing by it', () => {
    const html = render([{ kind: 'progress', order: 0, props: { value: 5, max: 0 } }])

    expect(html).toContain('width:0%')
    expect(html).not.toContain('NaN')
  })

  test('a badge with an off-contract status falls back to neutral', () => {
    const html = render([
      { kind: 'badge', order: 0, props: { text: 'En aduana', status: 'chartreuse' } },
    ])

    expect(html).toContain('En aduana')
    expect(html).not.toContain('chartreuse')
  })

  test('a divider needs no props at all', () => {
    expect(render([{ kind: 'divider', order: 0, props: {} }])).toContain('<hr')
  })
})

describe('the donut', () => {
  test('carries the total in its centre so nobody adds up slices', () => {
    const html = render([{ kind: 'breakdown-chart', order: 0, props: { dataKey: 'documents' } }])

    // sampleDatasets.documents sums to 10.
    expect(html).toContain('10')
    expect(html).toContain('Total')
  })

  test('the agent can name what the centre number is', () => {
    const html = render([
      {
        kind: 'breakdown-chart',
        order: 0,
        props: { dataKey: 'documents', centerLabel: 'Documentos' },
      },
    ])

    expect(html).toContain('Documentos')
  })
})

describe('parts pull from context, they are not handed props', () => {
  test('a chart nested two layouts deep reads its own dataKey', () => {
    // If the parts needed props, both layouts would have to forward a dataKey
    // they know nothing about. They do not, and this still renders.
    const html = render([
      {
        kind: 'layout',
        order: 0,
        props: { direction: 'row' },
        children: [
          {
            kind: 'layout',
            order: 0,
            props: { direction: 'column' },
            children: [
              { kind: 'breakdown-chart', order: 0, props: { dataKey: 'documents' } },
            ],
          },
        ],
      },
    ])

    expect(html).toContain('Total')
    expect(html).toContain('10')
  })

  test('sibling parts each take a different slice without colliding', () => {
    const html = render([
      { kind: 'stat', order: 0, props: { value: 'MIO', label: 'stat' } },
      { kind: 'badge', order: 1, props: { text: 'TUYO', status: 'success' } },
    ])

    expect(html).toContain('MIO')
    expect(html).toContain('TUYO')
  })
})

describe('operation slices', () => {
  test('a named slice of the operation feeds a table with no rows sent', () => {
    const operation = {
      trackId: 'op-1',
      shipper: 'Aceros',
      status: 'in_transit',
      health: 'on_track',
      origin: 'CLVAP',
      destination: 'ESVLC',
      containers: 2,
      eta: null,
      etd: null,
      updatedAt: '2026-08-30T00:00:00Z',
      lastEvent: null,
      companyIds: [],
      bookings: [
        {
          id: 'bk-1',
          carrier: 'MSC',
          vessel: 'MSC Aurora',
          originPort: 'CLVAP',
          destinationPort: 'ESVLC',
          schedule: { etdOriginal: '', etaOriginal: '', etaCurrent: '', changes: [] },
          containers: [{ id: 'c1', containerNumber: 'MSCU7741820', state: 'in_transit' }],
        },
      ],
      documents: [],
    } as never

    const html = renderToStaticMarkup(
      <ComponentDataProvider operation={operation}>
        {createTree([
          {
            kind: 'table',
            order: 0,
            props: {
              dataKey: 'containers',
              columns: [{ key: 'id', label: 'Contenedor' }],
            },
          },
        ])}
      </ComponentDataProvider>,
    )

    expect(html).toContain('MSCU7741820')
  })
})

describe('files', () => {
  test('picks the icon family from the extension when no type is given', () => {
    const html = render([
      { kind: 'file', order: 0, props: { name: 'bl-MSCU7741820.pdf' } },
      { kind: 'file', order: 1, props: { name: 'manifiesto.xlsx' } },
      { kind: 'file', order: 2, props: { name: 'ruta.pptx' } },
    ])

    expect(html).toContain('bl-MSCU7741820.pdf')
    expect(html).toContain('manifiesto.xlsx')
    expect(html).toContain('ruta.pptx')
  })

  test('an unknown extension still renders, as a generic file', () => {
    const html = render([{ kind: 'file', order: 0, props: { name: 'algo.qqq' } }])

    expect(html).toContain('algo.qqq')
    expect(html).toContain('Archivo')
  })

  test('only becomes a link when there is somewhere to go', () => {
    expect(render([{ kind: 'file', order: 0, props: { name: 'a.pdf' } }])).not.toContain('<a ')
    expect(
      render([{ kind: 'file', order: 0, props: { name: 'a.pdf', url: 'https://x.test/a.pdf' } }]),
    ).toContain('href="https://x.test/a.pdf"')
  })

  test('an explicit type wins over the extension', () => {
    const html = render([{ kind: 'file', order: 0, props: { name: 'sin-extension', type: 'excel' } }])

    expect(html).toContain('Excel')
  })
})
