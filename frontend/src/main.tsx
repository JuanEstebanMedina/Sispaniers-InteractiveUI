import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@fontsource-variable/inter'
import '@fontsource-variable/inter-tight'
import '@fontsource-variable/jetbrains-mono'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import 'leaflet/dist/leaflet.css'

import './index.css'

// Must come before anything that calls t() at module scope (the zod schemas do).
import { currentLocale } from './i18n'

import { App } from './App'
import { useAuthStore } from './auth/auth.store'
import { initTheme } from './stores/themeStore'

initTheme()
document.documentElement.lang = currentLocale()

window.addEventListener('unhandledrejection', (event) => {
  console.error('[unhandledrejection]', event.reason)
})

window.addEventListener('error', (event) => {
  console.error('[window.error]', event.error ?? event.message)
})

async function bootstrap() {
  await useAuthStore.getState().bootstrap()

  const container = document.getElementById('root')
  if (!container) throw new Error('#root not found in index.html')

  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
