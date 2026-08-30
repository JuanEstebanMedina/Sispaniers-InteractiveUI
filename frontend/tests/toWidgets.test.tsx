import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import { toWidgets } from '@/components/generated/toWidgets'
import type { GeneratedComponent, LayoutEntry } from '@/schemas/component.schema'

const AT: LayoutEntry = { id: 'c1', col: 0, row: 0, w: 4, h: 1 }

function component(content: GeneratedComponent['content']): GeneratedComponent {
  return {
    id: 'c1',
    operation_id: 'op-1',
    kind: 'container',
    content,
    size: 'small',
    priority: 'normal',
    created_at: '2026-08-30T00:00:00.000Z',
  }
}

function bodyOf(content: GeneratedComponent['content']): string {
  const [widget] = toWidgets([component(content)], [AT])
  if (!widget) throw new Error('no widget')
  return renderToStaticMarkup(widget.body)
}

function titleOf(content: GeneratedComponent['content']): string | undefined {
  return toWidgets([component(content)], [AT])[0]?.title
}

describe('the widget body', () => {
  test('a layout node renders its children rather than nothing', () => {
    const markup = bodyOf([
      {
        kind: 'layout',
        order: 0,
        props: { direction: 'row' },
        children: [{ kind: 'label', order: 0, props: { text: 'Bremen Express' } }],
      },
    ])

    expect(markup).toContain('Bremen Express')
  })

  test('a kind the renderer does not know announces itself instead of vanishing', () => {
    expect(bodyOf([{ kind: 'invented', order: 0, props: {} }])).toContain('invented')
  })
})

describe('the widget header', () => {
  test('takes the title even when the agent nested it inside a layout', () => {
    expect(
      titleOf([
        {
          kind: 'layout',
          order: 0,
          props: { direction: 'column' },
          children: [{ kind: 'title', order: 0, props: { text: 'Demurrage risk' } }],
        },
      ]),
    ).toBe('Demurrage risk')
  })

  test('a nested title is not painted twice', () => {
    const content: GeneratedComponent['content'] = [
      {
        kind: 'layout',
        order: 0,
        props: { direction: 'column' },
        children: [
          { kind: 'title', order: 0, props: { text: 'Demurrage risk' } },
          { kind: 'label', order: 1, props: { text: 'Zero free days left' } },
        ],
      },
    ]

    expect(titleOf(content)).toBe('Demurrage risk')
    const markup = bodyOf(content)
    expect(markup).toContain('Zero free days left')
    expect(markup).not.toContain('Demurrage risk')
  })

  test('the name the user typed wins over the one the agent generated', () => {
    const named = { ...component([{ kind: 'title', order: 0, props: { text: 'Agent' } }]), title: 'Mine' }
    expect(toWidgets([named], [AT])[0]?.title).toBe('Mine')
  })
})
