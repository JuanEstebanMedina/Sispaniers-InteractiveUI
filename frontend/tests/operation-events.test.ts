import { describe, expect, test } from 'vitest'

import { bindOperationEvents, type OperationEventHandler } from '@/hooks/useOperationEvents'

type Listener = (event: MessageEvent<string>) => void

class FakeEventSource {
  closed = false
  private readonly listeners = new Map<string, Set<Listener>>()

  addEventListener(name: string, listener: Listener): void {
    const forName = this.listeners.get(name) ?? new Set<Listener>()
    forName.add(listener)
    this.listeners.set(name, forName)
  }

  removeEventListener(name: string, listener: Listener): void {
    this.listeners.get(name)?.delete(listener)
  }

  close(): void {
    this.closed = true
  }

  emit(name: string, data = ''): void {
    for (const listener of this.listeners.get(name) ?? []) {
      listener({ data } as MessageEvent<string>)
    }
  }

  listenerCount(): number {
    let total = 0
    for (const forName of this.listeners.values()) total += forName.size
    return total
  }
}

function recorded(): { calls: string[]; handler: OperationEventHandler } {
  const calls: string[] = []
  return { calls, handler: (event) => calls.push(event) }
}

describe('bindOperationEvents', () => {
  test('reports a component event to the handler', () => {
    const source = new FakeEventSource()
    const { calls, handler } = recorded()

    bindOperationEvents(source, handler)
    source.emit('component-created', 'not json')

    expect(calls).toEqual(['component-created'])
  })

  /**
   * The connection is shared with the rest of the screen and closing it belongs
   * to the pool that opened it. A listener that closed it here would cut the
   * feed out from under every other subscriber.
   */
  test('leaves the connection alone: it belongs to whoever opened it', () => {
    const source = new FakeEventSource()
    const { handler } = recorded()

    bindOperationEvents(source, handler)
    source.emit('simulation-completed')

    expect(source.closed).toBe(false)
  })

  test('the end of the simulation is not reported as a component event', () => {
    const source = new FakeEventSource()
    const { calls, handler } = recorded()

    bindOperationEvents(source, handler)
    source.emit('simulation-completed')

    expect(calls).toEqual([])
  })

  test('tearing down removes every listener it added and nothing else', () => {
    const source = new FakeEventSource()
    const { calls, handler } = recorded()

    const teardown = bindOperationEvents(source, handler)
    teardown()
    source.emit('component-created', 'not json')

    expect(source.listenerCount()).toBe(0)
    expect(source.closed).toBe(false)
    expect(calls).toEqual([])
  })
})
