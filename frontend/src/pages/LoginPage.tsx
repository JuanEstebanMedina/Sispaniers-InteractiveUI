import { useForm } from '@tanstack/react-form'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { KeyRound, Mail } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { normalizeError } from '@/api/errors'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { FieldInput } from '@/components/ui/FieldInput'
import { Checkbox } from '@/components/ui/Toggle'
import { env } from '@/config/env'
import { toast } from '@/lib/toast'
import { createLoginSchema } from '@/schemas'

export default function LoginPage() {
  const { t } = useTranslation(['auth', 'common'])
  const { login } = useAuth()
  const navigate = useNavigate()

  const { redirect } = useSearch({ from: '/login' })

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
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
                <FieldInput
                  field={field}
                  required
                  label={t('auth:login.email')}
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder={t('auth:login.emailPlaceholder')}
                  leading={<Mail />}
                />
              )}
            </form.Field>

            <form.Field name="password">
              {(field) => (
                <FieldInput
                  field={field}
                  required
                  label={t('auth:login.password')}
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  leading={<KeyRound />}
                />
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

        <p className="mt-8 text-center text-xs text-fg-subtle">{t('auth:login.footer')}</p>
      </main>
    </div>
  )
}
