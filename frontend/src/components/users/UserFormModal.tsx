import { useForm } from '@tanstack/react-form'
import { useTranslation } from 'react-i18next'

import { api$ } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import { useIsAtLeast, useRoleLabels } from '@/auth/useAuth'
import { ROLES, type Role } from '@/auth/roles'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useCompanyDirectory } from '@/hooks'
import { toast } from '@/lib/toast'
import {
  userFormSchema,
  userResponseSchema,
  type CreateUserBody,
  type ManagedUser,
  type UpdateUserBody,
} from '@/schemas'

interface UserFormModalProps {
  open: boolean
  onClose: () => void
  /** Present → edit that user (PATCH). Absent → create one (POST). */
  user?: ManagedUser
  onSaved?: (user: ManagedUser) => void
}

function errorText(error: unknown): string | undefined {
  if (!error) return undefined
  if (typeof error === 'string') return error
  if (typeof error === 'object' && 'message' in error) return String(error.message)
  return String(error)
}

export function UserFormModal({ open, onClose, user, onSaved }: UserFormModalProps) {
  const { t } = useTranslation(['domain', 'common'])
  const isEdit = user !== undefined
  const isSuperadmin = useIsAtLeast('superadmin')
  const roleLabels = useRoleLabels()
  const companyDirectory = useCompanyDirectory()
  const assignableRoles: Role[] = isSuperadmin ? [...ROLES] : ['user', 'admin']

  const form = useForm({
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      password: '',
      role: (user?.role ?? 'user') as Role,
      companyId: user?.company_id ?? '',
    },
    validators: {
      onSubmit: userFormSchema(),
    },

    onSubmit: async ({ value, formApi }) => {
      if (!isEdit && !value.password) {
        formApi.setFieldMeta('password', (meta) => ({
          ...meta,
          errorMap: { ...meta.errorMap, onSubmit: t('validation:required') },
        }))
        return
      }

      try {
        const saved = isEdit
          ? await api$.patch(endpoints.users.update(user.id), userResponseSchema, {
              name: value.name.trim(),
              role: value.role,
              password: value.password.trim() || undefined,
            } satisfies UpdateUserBody)
          : await api$.post(endpoints.users.create, userResponseSchema, {
              email: value.email.trim(),
              password: value.password,
              name: value.name.trim(),
              role: value.role,
              company_id: isSuperadmin ? value.companyId || undefined : undefined,
            } satisfies CreateUserBody)

        toast.success(t('user.toasts.saved', { name: saved.name }))
        onSaved?.(saved)
        handleClose()
      } catch (error) {
        toast.apiError(error)
      }
    },
  })

  function handleClose() {
    form.reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t(isEdit ? 'user.modal.editTitle' : 'user.modal.title')}
      description={t('user.modal.description')}
      size="sm"
      footer={
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
          {([canSubmit, isSubmitting]) => (
            <>
              <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
                {t('actions.cancel')}
              </Button>
              <Button type="submit" form="user-form" loading={isSubmitting} disabled={!canSubmit}>
                {t(isEdit ? 'actions.save' : 'actions.create')}
              </Button>
            </>
          )}
        </form.Subscribe>
      }
    >
      <form
        id="user-form"
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          void form.handleSubmit()
        }}
      >
        <form.Field name="name">
          {(field) => (
            <Field
              label={t('user.fields.name')}
              required
              error={errorText(field.state.meta.errors[0])}
            >
              <Input
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                autoFocus
              />
            </Field>
          )}
        </form.Field>

        <form.Field name="email">
          {(field) => (
            <Field label={t('user.fields.email')} required>
              <Input
                type="email"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                disabled={isEdit}
                readOnly={isEdit}
              />
            </Field>
          )}
        </form.Field>

        <form.Field name="password">
          {(field) => (
            <Field
              label={t(isEdit ? 'user.fields.passwordEdit' : 'user.fields.password')}
              required={!isEdit}
              error={errorText(field.state.meta.errors[0])}
            >
              <Input
                type="password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder={isEdit ? t('user.fields.passwordPlaceholder') : '••••••••'}
              />
            </Field>
          )}
        </form.Field>

        <form.Field name="role">
          {(field) => (
            <Field label={t('user.fields.role')}>
              <Select
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value as Role)}
                options={assignableRoles.map((role) => ({
                  value: role,
                  label: roleLabels.label(role),
                }))}
              />
            </Field>
          )}
        </form.Field>

        {isSuperadmin && !isEdit && (
          <form.Field name="companyId">
            {(field) => (
              <Field label={t('user.fields.company')}>
                <Select
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  options={[
                    { value: '', label: t('user.fields.companyNone') },
                    ...Object.entries(companyDirectory).map(([id, name]) => ({
                      value: id,
                      label: name,
                    })),
                  ]}
                />
              </Field>
            )}
          </form.Field>
        )}
      </form>
    </Modal>
  )
}
