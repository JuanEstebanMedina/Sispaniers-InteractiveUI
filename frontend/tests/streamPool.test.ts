import { describe, expect, test } from 'vitest'

import { createStreamPool, type SharedStream } from '@/hooks/streamPool'

type Listener = (event: MessageEvent<string>) => void

function fakeStream(): SharedStream & { closed: number; emit(name: string): void } {
  const listeners = new Map<string, Set<Listener>>()

  return {
    closed: 0,
    readyState: 0,
    addEventListener(name: string, listener: Listener) {
      const set = listeners.get(name) ?? new Set()
      set.add(listener)
      listeners.set(name, set)
    },
    removeEventListener(name: string, listener: Listener) {
      listeners.get(name)?.delete(listener)
    },
    close() {
      this.closed += 1
    },
    emit(name: string) {
      for (const listener of listeners.get(name) ?? []) {
        listener(new MessageEvent(name, { data: '' }))
      }
    },
  }
}

function pool() {
  const made: ReturnType<typeof fakeStream>[] = []
  const instance = createStreamPool((_url: string) => {
    const stream = fakeStream()
    made.push(stream)
    return stream
  })
  return { instance, made }
}

describe('the stream pool', () => {
  test('two subscribers to one url share a single connection', () => {
    const { instance, made } = pool()

    const first = instance.acquire('/events/op-1')
    const second = instance.acquire('/events/op-1')

    expect(made).toHaveLength(1)
    expect(first.stream).toBe(second.stream)
  })

  test('the connection outlives a subscriber that leaves', () => {
    const { instance, made } = pool()

    const first = instance.acquire('/events/op-1')
    instance.acquire('/events/op-1')
    first.release()

    expect(made[0]?.closed).toBe(0)
  })

  test('the last subscriber to leave closes the connection', () => {
    const { instance, made } = pool()

    const first = instance.acquire('/events/op-1')
    const second = instance.acquire('/events/op-1')
    first.release()
    second.release()

    expect(made[0]?.closed).toBe(1)
  })

  test('releasing twice does not close a connection someone else reopened', () => {
    const { instance, made } = pool()

    const first = instance.acquire('/events/op-1')
    first.release()
    first.release()
    instance.acquire('/events/op-1')

    expect(made).toHaveLength(2)
    expect(made[1]?.closed).toBe(0)
  })

  test('different operations do not share a connection', () => {
    const { instance, made } = pool()

    instance.acquire('/events/op-1')
    instance.acquire('/events/op-2')

    expect(made).toHaveLength(2)
  })

  test('a url reopened after everyone left gets a fresh connection', () => {
    const { instance, made } = pool()

    instance.acquire('/events/op-1').release()
    instance.acquire('/events/op-1')

    expect(made).toHaveLength(2)
  })
})

describe('a feed the server has finished', () => {
  test('the stream closes instead of letting EventSource reconnect forever', () => {
    const { instance, made } = pool()

    instance.acquire('/events/op-1')
    made[0]?.emit('simulation-completed')

    expect(made[0]?.closed).toBe(1)
  })

  test('opening the same operation again gets a live connection, not the finished one', () => {
    const { instance, made } = pool()

    const lease = instance.acquire('/events/op-1')
    made[0]?.emit('simulation-completed')
    const reopened = instance.acquire('/events/op-1')

    expect(made).toHaveLength(2)
    expect(reopened.stream).not.toBe(lease.stream)
  })

  test('a subscriber leaving after the server finished does not close the new connection', () => {
    const { instance, made } = pool()

    const lease = instance.acquire('/events/op-1')
    made[0]?.emit('simulation-completed')
    instance.acquire('/events/op-1')
    lease.release()

    expect(made[1]?.closed).toBe(0)
  })
})
