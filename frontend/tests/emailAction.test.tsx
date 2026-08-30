import { fireEvent, render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { NodeProvider } from '@/components/generated/NodeContext'
import { EmailAction } from '@/components/generated/parts'
import type { ComponentNode } from '@/schemas/component.schema'

function emailNode(props: Record<string, unknown>): ComponentNode {
  return { kind: 'email-action', order: 0, props }
}

function draft(container: HTMLElement) {
  const subject = container.querySelectorAll('input')[1] as HTMLInputElement
  const body = container.querySelector('textarea') as HTMLTextAreaElement
  return { subject: subject.value, body: body.value }
}

describe('EmailAction', () => {
  test('shows the new draft when the agent rewrites the component', () => {
    const before = emailNode({
      to: 'compras@florestropicales.co',
      subject: 'Follow-up — booking confirmation pending',
      body: 'Hi,\n\nWe still do not have a booking confirmation.',
    })

    const { container, rerender } = render(
      <NodeProvider node={before}>
        <EmailAction />
      </NodeProvider>,
    )
    expect(draft(container).subject).toBe('Follow-up — booking confirmation pending')

    const after = emailNode({
      to: 'compras@florestropicales.co',
      subject: 'Booking de septiembre — ¿alguna novedad?',
      body: 'Hola,\n\n¿Tienen alguna novedad?',
    })
    rerender(
      <NodeProvider node={after}>
        <EmailAction />
      </NodeProvider>,
    )

    expect(draft(container)).toEqual({
      subject: 'Booking de septiembre — ¿alguna novedad?',
      body: 'Hola,\n\n¿Tienen alguna novedad?',
    })
  })

  test('keeps what the user is typing when the component re-renders unchanged', () => {
    const node = emailNode({ to: 'ops@carrier.co', subject: 'Booking', body: 'Hi,' })

    const { container, rerender } = render(
      <NodeProvider node={node}>
        <EmailAction />
      </NodeProvider>,
    )

    const subject = container.querySelectorAll('input')[1] as HTMLInputElement
    fireEvent.change(subject, { target: { value: 'Booking — urgent' } })

    rerender(
      <NodeProvider node={emailNode({ ...node.props })}>
        <EmailAction />
      </NodeProvider>,
    )

    expect(draft(container).subject).toBe('Booking — urgent')
  })

  test('an email the server marks as sent can no longer be edited or resent', () => {
    const node = emailNode({
      to: 'ops@carrier.co',
      subject: 'Booking',
      body: 'Hi,',
      sentAt: '2026-08-30T12:00:00.000Z',
    })

    const { container } = render(
      <NodeProvider node={node}>
        <EmailAction />
      </NodeProvider>,
    )

    const subject = container.querySelectorAll('input')[1] as HTMLInputElement
    const button = container.querySelector('button') as HTMLButtonElement

    expect(subject.disabled).toBe(true)
    expect(button.disabled).toBe(true)
  })

  test('a draft that has not been sent stays editable', () => {
    const { container } = render(
      <NodeProvider node={emailNode({ to: 'ops@carrier.co', subject: 'B', body: 'Hi' })}>
        <EmailAction />
      </NodeProvider>,
    )

    const subject = container.querySelectorAll('input')[1] as HTMLInputElement
    expect(subject.disabled).toBe(false)
  })
})
