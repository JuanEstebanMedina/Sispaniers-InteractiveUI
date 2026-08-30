import { z } from 'zod'

const booleanish = z
  .union([z.string(), z.boolean()])
  .default(false)
  .transform((value) => {
    if (typeof value === 'boolean') return value
    return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase())
  })

const envSchema = z.object({
  VITE_API_URL: z
    .string()
    .min(1, 'VITE_API_URL is required (e.g. http://localhost:8000/api or /api)')
    .default('/api'),

  VITE_API_TIMEOUT: z.coerce.number().int().positive().default(15_000),

  VITE_THEME: z.enum(['light', 'dark', 'system']).default('light'),

  VITE_LOCALE: z.enum(['es', 'en', 'pt-BR', '']).default(''),

  VITE_APP_NAME: z.string().default('Sispaniers'),

  VITE_AUTH_STORAGE: z.enum(['localStorage', 'sessionStorage', 'memory']).default('localStorage'),

  VITE_WS_URL: z.string().optional(),

  VITE_DEVTOOLS: booleanish,

  VITE_SENTRY_DSN: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

function parseEnv(): Env {
  const result = envSchema.safeParse(import.meta.env)

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  · ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')

    const message =
      `\n╭─ Invalid configuration ───────────────────────────────╮\n` +
      `${issues}\n` +
      `╰───────────────────────────────────────────────────────╯\n` +
      `Copy .env.example to .env and fill in the values.\n`

    if (import.meta.env.DEV) throw new Error(message)

    console.error(message)
    return envSchema.parse({})
  }

  return result.data
}

export const env = parseEnv()

export const isDev = import.meta.env.DEV
export const isProd = import.meta.env.PROD
export const mode = import.meta.env.MODE
