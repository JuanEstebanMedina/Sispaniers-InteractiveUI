import { setupWorker } from 'msw/browser'

import { handlers } from './handlers'
import { MOCK_WORKER_FILE, dropStaleWorkers } from './staleWorkers'

export const worker = setupWorker(...handlers)

export async function startMocks(): Promise<void> {
  await dropStaleWorkers(navigator.serviceWorker)

  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: false,
    serviceWorker: {
      url: `${import.meta.env.BASE_URL}${MOCK_WORKER_FILE}`,
      // The browser may serve a worker script from its own cache for up to a
      // day, which is how a build from a previous server outlives it.
      options: { updateViaCache: 'none' },
    },
  })

  // A tab that closes cleanly takes its id with it. That misses a crash, which
  // is what `dropStaleWorkers` covers on the way in.
  window.addEventListener('pagehide', () => worker.stop())

  console.info(
    '%c[MSW] Mock data active',
    'color:#f59e0b;font-weight:600',
    '\nOnly /auth/* is mocked; the backend serves everything else.',
  )
}
