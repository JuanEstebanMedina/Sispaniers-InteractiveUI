import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: Number(env.VITE_PORT ?? 5173),
      proxy: env.VITE_API_PROXY
        ? {
            '/api': {
              target: env.VITE_API_PROXY,
              changeOrigin: true,
              secure: false,
            },
          }
        : undefined,
    },
    build: {
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (/[\\/]recharts|[\\/]d3-|[\\/]victory-/.test(id)) return 'charts'
            if (/[\\/]react-dom|[\\/]react-router|[\\/]react[\\/]/.test(id)) return 'react'
            if (/[\\/]@tanstack|[\\/]axios|[\\/]zod/.test(id)) return 'data'
          },
        },
      },
    },
  }
})
