import { setupWorker } from 'msw/browser'

import { handlers } from './handlers'

export const worker = setupWorker(...handlers)

export async function startMocks(): Promise<void> {
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: false,
    serviceWorker: {
      url: `${import.meta.env.BASE_URL}mockServiceWorker.js`,
    },
  })

  console.info(
    '%c[MSW] Mock data active',
    'color:#f59e0b;font-weight:600',
    '\nTo turn it off: VITE_USE_MOCKS=false in .env',
  )
}
