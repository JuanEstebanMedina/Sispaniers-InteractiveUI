import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const post = vi.fn(async () => ({}))
vi.mock('@/api/client', () => ({ http: { post: (...args: unknown[]) => post(...args) } }))
vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn(), apiError: vi.fn(), info: vi.fn() },
}))

const { ComponentIdProvider, NodeProvider } = await import('@/components/generated/NodeContext')
const { EmailAction } = await import('@/components/generated/parts')
type ComponentNode = import('@/schemas/component.schema').ComponentNode

const node: ComponentNode = {
  kind: 'email-action',
  order: 0,
  props: { to: 'ops@carrier.co', subject: 'Booking', body: 'Hi' },
}

function renderSent(onEmailSent: (id: string) => void) {
  return render(
    <ComponentIdProvider componentId="cmp-1" onEmailSent={onEmailSent}>
      <NodeProvider node={node}>
        <EmailAction />
      </NodeProvider>
    </ComponentIdProvider>,
  )
}

describe('EmailAction send', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.useRealTimers())

  test('a sent draft asks to be removed once its exit animation is done', async () => {
    const onEmailSent = vi.fn()
    const { container } = renderSent(onEmailSent)

    const button = container.querySelector('button') as HTMLButtonElement
    button.click()

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    // The draft is on its way out and must not be sent twice on the way.
    await waitFor(() => expect(button.disabled).toBe(true))
    await waitFor(() => expect(onEmailSent).toHaveBeenCalledWith('cmp-1'), { timeout: 2000 })
  })

  test('a failed send leaves the draft on screen and sends nothing away', async () => {
    post.mockRejectedValueOnce(new Error('nope'))
    const onEmailSent = vi.fn()
    const { container } = renderSent(onEmailSent)

    const button = container.querySelector('button') as HTMLButtonElement
    button.click()

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(button.disabled).toBe(false))
    expect(onEmailSent).not.toHaveBeenCalled()
  })
})
