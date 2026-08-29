import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { ArrowLeft, Home, Lock, SearchX } from 'lucide-react'
import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'

import { useRole, useRoleLabels } from '@/auth/useAuth'
import { Button, buttonVariants } from '@/components/ui/Button'
import { isDev } from '@/config/env'

function ErrorLayout({
  icon,
  code,
  title,
  description,
  children,
}: {
  icon: ReactNode
  code: string
  title: string
  description: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-surface-hover text-fg-subtle [&_svg]:size-7">
        {icon}
      </div>

      <p className="data-mono text-sm text-fg-subtle">{code}</p>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">{title}</h1>
      <div className="max-w-prose text-base text-fg-muted">{description}</div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{children}</div>
    </div>
  )
}

export function NotFoundPage() {
  const { t } = useTranslation(['errors', 'common'])
  const router = useRouter()

  return (
    <ErrorLayout
      icon={<SearchX />}
      code="404"
      title={t('errors:notFoundPage.title')}
      description={t('errors:notFoundPage.body')}
    >
      <Button variant="secondary" icon={<ArrowLeft />} onClick={() => router.history.back()}>
        {t('common:actions.back')}
      </Button>

      <Link to="/" className={buttonVariants({ variant: 'primary' })}>
        <Home aria-hidden />
        {t('common:actions.goToDashboard')}
      </Link>
    </ErrorLayout>
  )
}

export function ForbiddenPage() {
  const { t } = useTranslation(['errors', 'common'])
  const navigate = useNavigate()
  const router = useRouter()
  const role = useRole()
  const roleLabels = useRoleLabels()

  return (
    <ErrorLayout
      icon={<Lock />}
      code="403"
      title={t('errors:forbiddenPage.title')}
      description={
        <>
          {role ? (
            <Trans
              i18nKey="errors:forbiddenPage.bodyWithRole"
              values={{ role: roleLabels.label(role) }}
              components={[<span key="0" />, <strong key="1" className="text-fg" />]}
            />
          ) : (
            t('errors:forbiddenPage.bodyNoRole')
          )}{' '}
          {t('errors:forbiddenPage.hint')}
        </>
      }
    >
      <Button variant="secondary" icon={<ArrowLeft />} onClick={() => router.history.back()}>
        {t('common:actions.back')}
      </Button>
      <Button icon={<Home />} onClick={() => void navigate({ to: '/' })}>
        {t('common:actions.goToDashboard')}
      </Button>
    </ErrorLayout>
  )
}

export function RouteErrorPage({ error }: { error?: Error }) {
  const { t } = useTranslation(['errors', 'common'])

  return (
    <ErrorLayout
      icon={<SearchX />}
      code="500"
      title={t('errors:boundary.title')}
      description={
        <>
          {t('errors:boundary.body')}
          {isDev && error && (
            <pre className="scroll-x mt-4 rounded-md bg-surface-sunken p-3 text-left text-2xs text-fg-muted">
              {error.stack ?? error.message}
            </pre>
          )}
        </>
      }
    >
      <Button onClick={() => window.location.assign('/')} icon={<Home />}>
        {t('common:actions.goToDashboard')}
      </Button>
    </ErrorLayout>
  )
}
