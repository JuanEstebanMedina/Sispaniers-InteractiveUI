import { useRouterState } from '@tanstack/react-router'
import { Construction } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/feedback/EmptyState'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'

const TITLE_BY_PATH: Record<string, string> = {
  '/assistant': 'assistant',
  '/settings': 'settings',
  '/profile': 'profile',
}

const PLAN_BY_PATH: Record<string, string[]> = {
  '/assistant': [
    'Streaming answers (SSE) so it visibly types',
    'Cite the source of every figure: no reference, no answer',
    'Suggested actions the user confirms before they run',
  ],
}

export default function PlaceholderPage() {
  const { t } = useTranslation()
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  const matched = Object.keys(TITLE_BY_PATH)
    .filter((path) => pathname.startsWith(path))
    .sort((a, b) => b.length - a.length)[0]

  const title = matched ? t(`nav.items.${TITLE_BY_PATH[matched]}` as never) : pathname
  const plan = matched ? PLAN_BY_PATH[matched] : undefined

  return (
    <PageContainer>
      <PageHeader title={title} />

      <Card>
        <EmptyState
          icon={<Construction aria-hidden />}
          title={t('placeholder.title')}
          description={
            <>
              {t('placeholder.description')}
              {plan && plan.length > 0 && (
                <span className="mt-4 block text-left">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-fg-subtle">
                    {t('placeholder.planned')}
                  </span>
                  <ul className="space-y-0.5 text-sm">
                    {plan.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span
                          className="mt-1.5 size-1 shrink-0 rounded-full bg-fg-subtle"
                          aria-hidden
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </span>
              )}
            </>
          }
        />
      </Card>
    </PageContainer>
  )
}
