import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, CircleCheck, Pencil, Plus, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { api$ } from '@/api/client'
import { endpoints, queryKeys } from '@/api/endpoints'
import { useIsAtLeast, useRoleLabels } from '@/auth/useAuth'
import { ROLE_TONE } from '@/auth/roles'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/layout/PageHeader'
import { UserFormModal } from '@/components/users/UserFormModal'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { columnHelperFor, DataTable } from '@/components/ui/Table'
import { useCompanyDirectory, useDisclosure } from '@/hooks'
import { toast } from '@/lib/toast'
import { type ManagedUser, userListSchema, userResponseSchema } from '@/schemas'

const column = columnHelperFor<ManagedUser>()

export default function UsersPage() {
  const { t } = useTranslation(['domain', 'common'])
  const roleLabels = useRoleLabels()
  const isSuperadmin = useIsAtLeast('superadmin')
  const companyDirectory = useCompanyDirectory()
  const queryClient = useQueryClient()
  const formModal = useDisclosure()
  const [editing, setEditing] = useState<ManagedUser | undefined>(undefined)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const list = useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: () => api$.get(endpoints.users.list, userListSchema),
    refetchOnWindowFocus: true,
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
  }

  function openCreate() {
    setEditing(undefined)
    formModal.open()
  }

  function openEdit(user: ManagedUser) {
    setEditing(user)
    formModal.open()
  }

  async function toggleActive(user: ManagedUser) {
    setTogglingId(user.id)
    try {
      const updated = await api$.patch(endpoints.users.update(user.id), userResponseSchema, {
        active: !user.active,
      })
      toast.success(
        t(updated.active ? 'user.toasts.enabled' : 'user.toasts.disabled', { name: updated.name }),
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
      column.accessor('name', { header: t('user.fields.name'), meta: { primary: true } }),
      column.accessor('email', { header: t('user.fields.email') }),
      column.accessor('role', {
        header: t('user.fields.role'),
        cell: ({ getValue }) => (
          <Badge tone={ROLE_TONE[getValue()]} size="sm">
            {roleLabels.label(getValue())}
          </Badge>
        ),
      }),
      ...(isSuperadmin
        ? [
            column.accessor((row) => (row.company_id ? companyDirectory[row.company_id] : ''), {
              id: 'company',
              header: t('user.fields.company'),
              cell: ({ getValue }) => getValue() || '—',
            }),
          ]
        : []),
      column.accessor('active', {
        header: t('user.fields.status'),
        cell: ({ getValue }) => (
          <Badge tone={getValue() ? 'success' : 'neutral'} size="sm">
            {t(getValue() ? 'user.status.active' : 'user.status.disabled')}
          </Badge>
        ),
      }),
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
    ],
    [t, roleLabels, isSuperadmin, companyDirectory, togglingId],
  )

  return (
    <PageContainer>
      <PageHeader
        title={t('user.title')}
        description={t('user.subtitle')}
        actions={
          <Button icon={<Plus />} onClick={openCreate}>
            {t('user.actions.create')}
          </Button>
        }
      />

      <Card>
        <DataTable
          columns={columns}
          rows={list.data?.users}
          getRowId={(row) => row.id}
          isLoading={list.isPending}
          error={list.isError ? list.error : undefined}
          onRetry={() => void list.refetch()}
          emptyTitle={t('user.emptyTitle')}
          emptyDescription={t('user.emptyHint')}
          emptyAction={
            <Button size="sm" icon={<UserPlus />} onClick={openCreate}>
              {t('user.actions.create')}
            </Button>
          }
        />
      </Card>

      <UserFormModal
        key={editing?.id ?? 'new'}
        open={formModal.isOpen}
        onClose={formModal.close}
        user={editing}
        onSaved={invalidate}
      />
    </PageContainer>
  )
}
