import { useForm } from '@tanstack/react-form'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { KeyRound, Mail } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { normalizeError } from '@/api/errors'
import type { Role } from '@/auth/roles'
import { useAuth, useRoleLabels } from '@/auth/useAuth'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Checkbox } from '@/components/ui/Toggle'
import { env } from '@/config/env'
import { cn } from '@/lib/cn'
import { toast } from '@/lib/toast'
import { createLoginSchema } from '@/schemas'

const DEMO_ACCOUNTS: { email: string; role: Role }[] = [
  { email: 'admin@yuno.com', role: 'admin' },
  { email: 'supervisor@yuno.com', role: 'manager' },
  { email: 'operator@nauta.com', role: 'operator' },
  { email: 'analyst@nauta.com', role: 'analyst' },
  { email: 'guest@yuno.com', role: 'viewer' },
]

const DEMO_PASSWORD = 'demo1234'

function errorText(error: unknown): string | undefined {
  if (!error) return undefined
  if (typeof error === 'string') return error
  if (typeof error === 'object' && 'message' in error) return String(error.message)
  return String(error)
}

export default function LoginPage() {
  const { t } = useTranslation(['auth', 'common'])
  const { login } = useAuth()
  const roleLabels = useRoleLabels()
  const navigate = useNavigate()

  const { redirect } = useSearch({ from: '/login' })

  const form = useForm({
    defaultValues: {
      email: env.VITE_DEMO_MODE ? 'admin@yuno.com' : '',
      password: env.VITE_DEMO_MODE ? DEMO_PASSWORD : '',
      remember: true,
    },
    validators: { onSubmit: createLoginSchema() },

    onSubmit: async ({ value, formApi }) => {
      try {
        const user = await login(value)
        toast.success(t('auth:login.welcome', { name: user.name.split(' ')[0] }))
        await navigate({ to: redirect ?? '/' })
      } catch (error) {
        const apiError = normalizeError(error)

        if (apiError.hasFieldErrors) {
          for (const [field, messages] of Object.entries(apiError.fieldErrors)) {
            formApi.setFieldMeta(field as 'email' | 'password', (meta) => ({
              ...meta,
              errorMap: { ...meta.errorMap, onSubmit: messages[0] },
            }))
          }
          return
        }

        if (apiError.kind === 'unauthorized') {
          formApi.setFieldMeta('password', (meta) => ({
            ...meta,
            errorMap: { ...meta.errorMap, onSubmit: t('auth:login.invalidCredentials') },
          }))
          return
        }

        toast.apiError(apiError)
      }
    },
  })

  const fillAccount = (email: string) => {
    form.setFieldValue('email', email)
    form.setFieldValue('password', DEMO_PASSWORD)
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-canvas px-4 py-12">
      <div
        className="pointer-events-none absolute left-1/2 top-0 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand opacity-[0.07] blur-3xl"
        aria-hidden
      />

      <main className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex size-11 items-center justify-center rounded-lg bg-brand text-brand-fg">
            <span className="font-display text-lg font-bold">{env.VITE_APP_NAME.charAt(0)}</span>
          </div>
          <span className="mt-3 font-display text-md font-semibold text-fg">
            {env.VITE_APP_NAME}
          </span>

          <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight text-fg">
            {t('auth:login.title')}
          </h1>
          <p className="mt-1 text-base text-fg-muted">{t('auth:login.subtitle')}</p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-6 shadow-lg sm:p-8">
          <form
            noValidate
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              event.stopPropagation()
              void form.handleSubmit()
            }}
          >
            <form.Field name="email">
              {(field) => (
                <Field
                  label={t('auth:login.email')}
                  required
                  error={errorText(field.state.meta.errors[0])}
                >
                  <Input
                    type="email"
                    autoComplete="email"
                    autoFocus
                    placeholder={t('auth:login.emailPlaceholder')}
                    leading={<Mail />}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="password">
              {(field) => (
                <Field
                  label={t('auth:login.password')}
                  required
                  error={errorText(field.state.meta.errors[0])}
                >
                  <Input
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    leading={<KeyRound />}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </Field>
              )}
            </form.Field>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <form.Field name="remember">
                {(field) => (
                  <Checkbox
                    label={t('auth:login.remember')}
                    checked={field.state.value}
                    onChange={(event) => field.handleChange(event.target.checked)}
                  />
                )}
              </form.Field>

              <button
                type="button"
                className="rounded-xs text-sm text-brand underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                onClick={() => toast.info(t('auth:login.forgotPending'))}
              >
                {t('auth:login.forgot')}
              </button>
            </div>

            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
              {([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  fullWidth
                  size="lg"
                  className="mt-2"
                  loading={isSubmitting}
                  disabled={!canSubmit}
                >
                  {t('auth:login.submit')}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </div>

        {env.VITE_DEMO_MODE && (
          <section className="mt-6 rounded-xl border border-dashed border-line p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
                {t('auth:demo.title')}
              </p>
              <p className="text-xs text-fg-muted">
                {t('auth:demo.password')}:{' '}
                <code className="data-mono select-all text-fg">{DEMO_PASSWORD}</code>
              </p>
            </div>

            <p className="mt-1 text-xs text-fg-muted">{t('auth:demo.hint')}</p>

            <ul className="mt-3 space-y-0.5">
              {DEMO_ACCOUNTS.map((account) => (
                <li key={account.email}>
                  <button
                    type="button"
                    onClick={() => fillAccount(account.email)}
                    title={roleLabels.description(account.role)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-sm px-2 py-1.5',
                      'text-left text-sm transition-colors hover:bg-surface-hover',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    )}
                  >
                    <span className="truncate text-fg-muted">{account.email}</span>
                    <Badge size="sm" tone="outline">
                      {roleLabels.label(account.role)}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-8 text-center text-xs text-fg-subtle">{t('auth:login.footer')}</p>
      </main>
    </div>
  )
}
