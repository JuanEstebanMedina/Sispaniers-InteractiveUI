import { HttpResponse, delay, http } from 'msw'

import { env } from '@/config/env'
import { users } from './db'

const BASE = env.VITE_API_URL.replace(/\/$/, '')
const url = (path: string) => `${BASE}${path}`

const latency = () => delay(env.VITE_MOCK_DELAY)

const sessions = new Map<string, string>()

function issueToken(userId: string): string {
  const token = `mock_${crypto.randomUUID()}`
  sessions.set(token, userId)
  return token
}

function userFromRequest(request: Request) {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const userId = sessions.get(header.slice(7))
  return users.find((user) => user.id === userId) ?? null
}

const unauthorized = () =>
  HttpResponse.json({ message: 'Invalid or expired token', code: 'UNAUTHORIZED' }, { status: 401 })

const publicUser = ({ password: _password, ...user }: (typeof users)[number]) => user

export const handlers = [
  http.post(url('/auth/login'), async ({ request }) => {
    await latency()

    const body = (await request.json()) as { email?: string; password?: string }
    const email = body.email?.trim().toLowerCase()

    const errors: Record<string, string[]> = {}
    if (!email) errors.email = ['Email is required']
    if (!body.password) errors.password = ['Password is required']

    if (Object.keys(errors).length > 0) {
      return HttpResponse.json({ message: 'Invalid data', errors }, { status: 422 })
    }

    const user = users.find((candidate) => candidate.email === email)

    if (!user || user.password !== body.password) {
      return HttpResponse.json(
        { message: 'Wrong email or password', code: 'INVALID_CREDENTIALS' },
        { status: 401 },
      )
    }

    return HttpResponse.json({
      user: publicUser(user),
      accessToken: issueToken(user.id),
      refreshToken: `refresh_${user.id}`,
      expiresIn: 3600,
    })
  }),

  http.get(url('/auth/me'), async ({ request }) => {
    await latency()
    const user = userFromRequest(request)
    return user ? HttpResponse.json(publicUser(user)) : unauthorized()
  }),

  http.post(url('/auth/refresh'), async ({ request }) => {
    await latency()
    const body = (await request.json()) as { refreshToken?: string }
    const userId = body.refreshToken?.replace('refresh_', '')
    const user = users.find((candidate) => candidate.id === userId)

    if (!user) return unauthorized()

    return HttpResponse.json({
      accessToken: issueToken(user.id),
      refreshToken: `refresh_${user.id}`,
      expiresIn: 3600,
    })
  }),

  http.post(url('/auth/logout'), async ({ request }) => {
    await latency()
    const header = request.headers.get('Authorization')
    if (header?.startsWith('Bearer ')) sessions.delete(header.slice(7))
    return new HttpResponse(null, { status: 204 })
  }),

  /**
   * MODO HÍBRIDO — lo único que sigue simulado.
   *
   * El dominio (`/api/flows`) lo sirve el backend real; MSW no lo intercepta y
   * `onUnhandledRequest: 'bypass'` lo deja pasar al proxy de Vite. Acá sólo
   * queda lo que el backend TODAVÍA no tiene, y cada handler se borra el día
   * que exista de verdad:
   *
   *   · auth — el backend no tiene autenticación ("No authentication yet")
   *   · layout de widgets — no hay endpoint que lo persista
   */
  http.patch(url('/flows/:id/layout'), async ({ request }) => {
    await latency()
    if (!userFromRequest(request)) return unauthorized()

    const body = (await request.json()) as { layout?: unknown }
    if (!Array.isArray(body.layout)) {
      return HttpResponse.json(
        { message: 'Invalid layout', errors: { layout: ['Expected an array of widgets'] } },
        { status: 422 },
      )
    }

    // No se guarda en ningún lado a propósito: es un 200 honesto para que la
    // grilla no acumule errores en consola mientras el backend no lo soporte.
    return HttpResponse.json({ layout: body.layout })
  }),

  http.get(url('/health'), () => HttpResponse.json({ status: 'ok', mocked: true })),
]
