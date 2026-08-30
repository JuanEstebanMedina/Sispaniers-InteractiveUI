import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Building2, CircleCheck, Pencil, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { api$ } from '@/api/client'
import { endpoints, queryKeys } from '@/api/endpoints'
import { useAuthStore } from '@/auth/auth.store'
import { CompanyFormModal } from '@/components/companies/CompanyFormModal'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { columnHelperFor, DataTable } from '@/components/ui/Table'
import { useDisclosure } from '@/hooks'
import { toast } from '@/lib/toast'
import { type Company, companyResponseSchema, companyListSchema } from '@/schemas'

const column = columnHelperFor<Company>()

export default function CompaniesPage() {
  const { t } = useTranslation(['domain', 'common'])
  const can = useAuthStore((state) => state.can)
  const queryClient = useQueryClient()
  const formModal = useDisclosure()
  const [editing, setEditing] = useState<Company | undefined>(undefined)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const list = useQuery({
    queryKey: queryKeys.companies.list(),
    queryFn: () => api$.get(endpoints.companies.list, companyListSchema),
    // Companies can also be created outside this tab — e.g. the email-intake
    // flow finds-or-creates one server-side. Same pattern as the operations
    // grid/rail: poll, and catch up right away when the tab regains focus.
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.companies.all })
  }

  function openCreate() {
    setEditing(undefined)
    formModal.open()
  }

  function openEdit(company: Company) {
    setEditing(company)
    formModal.open()
  }

  async function toggleActive(company: Company) {
    setTogglingId(company.id)
    try {
      const updated = await api$.patch(
        endpoints.companies.update(company.id),
        companyResponseSchema,
        { active: !company.active },
      )
      toast.success(
        t(updated.active ? 'company.toasts.enabled' : 'company.toasts.disabled', {
          name: updated.name,
        }),
      )
      invalidate()
    } catch (error) {
      toast.apiError(error)
    } finally {
      setTogglingId(null)
    }
  }

  const columns = useMemo(
    () => [
      column.accessor('name', { header: t('company.fields.name'), meta: { primary: true } }),
      column.accessor((row) => row.contact_emails.join(', '), {
        id: 'contactEmails',
        header: t('company.fields.contactEmail'),
        cell: ({ getValue }) => getValue() || '—',
      }),
      column.accessor('preferred_notification_channel', {
        header: t('company.fields.notificationChannel'),
        cell: ({ getValue }) => t(`company.channels.${getValue()}`),
      }),
      column.accessor('active', {
        header: t('company.fields.status'),
        cell: ({ getValue }) => (
          <Badge tone={getValue() ? 'success' : 'neutral'} size="sm">
            {t(getValue() ? 'company.status.active' : 'company.status.disabled')}
          </Badge>
        ),
      }),
      ...(can('companies:update')
        ? [
            column.display({
              id: 'actions',
              header: '',
              meta: { align: 'right' as const },
              cell: ({ row }) => (
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('actions.edit')}
                    title={t('actions.edit')}
                    onClick={(event) => {
                      event.stopPropagation()
                      openEdit(row.original)
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t(row.original.active ? 'actions.disable' : 'actions.enable')}
                    title={t(row.original.active ? 'actions.disable' : 'actions.enable')}
                    loading={togglingId === row.original.id}
                    onClick={(event) => {
                      event.stopPropagation()
                      void toggleActive(row.original)
                    }}
                  >
                    {row.original.active ? <Ban /> : <CircleCheck />}
                  </Button>
                </div>
              ),
            }),
          ]
        : []),
    ],
    [t, can, togglingId],
  )

  return (
    <PageContainer>
      <PageHeader
        title={t('company.title')}
        description={t('company.subtitle')}
        actions={
          can('companies:create') && (
            <Button icon={<Plus />} onClick={openCreate}>
              {t('company.actions.create')}
            </Button>
          )
        }
      />

      <Card>
        <DataTable
          columns={columns}
          rows={list.data?.companies}
          getRowId={(row) => row.id}
          isLoading={list.isPending}
          error={list.isError ? list.error : undefined}
          onRetry={() => void list.refetch()}
          emptyTitle={t('company.emptyTitle')}
          emptyDescription={t('company.emptyHint')}
          emptyAction={
            can('companies:create') && (
              <Button size="sm" icon={<Building2 />} onClick={openCreate}>
                {t('company.actions.create')}
              </Button>
            )
          }
        />
      </Card>

      <CompanyFormModal
        key={editing?.id ?? 'new'}
        open={formModal.isOpen}
        onClose={formModal.close}
        company={editing}
        onSaved={invalidate}
      />
    </PageContainer>
  )
}
