import { describe, expect, test } from 'vitest'

import { dropStaleWorkers, MOCK_WORKER_FILE } from '@/mocks/staleWorkers'

function registration(scriptURL: string) {
  return { active: { scriptURL }, unregister: async () => true }
}

function container(scriptURLs: string[]) {
  const unregistered: string[] = []

  return {
    unregistered,
    getRegistrations: async () =>
      scriptURLs.map((scriptURL) => ({
        ...registration(scriptURL),
        unregister: async () => {
          unregistered.push(scriptURL)
          return true
        },
      })),
  }
}

describe('dropStaleWorkers', () => {
  test('removes the mock worker so the next one starts with no client ids', async () => {
    const sw = container([`http://localhost:5173/${MOCK_WORKER_FILE}`])
    await dropStaleWorkers(sw)
    expect(sw.unregistered).toEqual([`http://localhost:5173/${MOCK_WORKER_FILE}`])
  })

  test('leaves a worker that is not ours alone', async () => {
    const sw = container(['http://localhost:5173/sw.js'])
    await dropStaleWorkers(sw)
    expect(sw.unregistered).toEqual([])
  })

  test('a browser with no service workers at all is not an error', async () => {
    await expect(dropStaleWorkers(undefined)).resolves.toBeUndefined()
  })
})
