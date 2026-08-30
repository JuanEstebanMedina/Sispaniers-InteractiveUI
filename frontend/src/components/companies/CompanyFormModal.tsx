import { useForm } from '@tanstack/react-form'
import { useTranslation } from 'react-i18next'

import { api$ } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/lib/toast'
import {
  companyResponseSchema,
  createCompanyFormSchema,
  type Company,
  type CreateCompanyBody,
  type NotificationChannel,
  type UpdateCompanyBody,
} from '@/schemas'

// The backend still accepts `slack`, but there's no Slack integration to
// point it at yet — offering it as a choice here would just be a dead end.
const MODAL_NOTIFICATION_CHANNELS: NotificationChannel[] = ['email']

interface CompanyFormModalProps {
  open: boolean
  onClose: () => void
  /** Present → edit that company (PATCH). Absent → create one (POST). */
  company?: Company
  onSaved?: (company: Company) => void
}

function errorText(error: unknown): string | undefined {
  if (!error) return undefined
  if (typeof error === 'string') return error
  if (typeof error === 'object' && 'message' in error) return String(error.message)
  return String(error)
}

export function CompanyFormModal({ open, onClose, company, onSaved }: CompanyFormModalProps) {
  const { t } = useTranslation(['domain', 'common'])
  const isEdit = company !== undefined

  const form = useForm({
    defaultValues: {
      name: company?.name ?? '',
      contactEmail: company?.contact_emails[0] ?? '',
      notificationChannel: (company?.preferred_notification_channel ??
        'email') as NotificationChannel,
    },
    validators: { onSubmit: createCompanyFormSchema() },

    onSubmit: async ({ value }) => {
      try {
        const contactEmails = [value.contactEmail.trim()]

        const saved = isEdit
          ? await api$.patch(endpoints.companies.update(company.id), companyResponseSchema, {
              name: value.name.trim(),
              contact_emails: contactEmails,
              preferred_notification_channel: value.notificationChannel,
            } satisfies UpdateCompanyBody)
          : await api$.post(endpoints.companies.create, companyResponseSchema, {
              name: value.name.trim(),
              contact_emails: contactEmails,
              preferred_notification_channel: value.notificationChannel,
            } satisfies CreateCompanyBody)

        toast.success(t('company.toasts.saved', { name: saved.name }))
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
      title={t(isEdit ? 'company.modal.editTitle' : 'company.modal.title')}
      description={t('company.modal.description')}
      size="sm"
      footer={
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
          {([canSubmit, isSubmitting]) => (
            <>
              <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
                {t('actions.cancel')}
              </Button>
              <Button
                type="submit"
                form="company-form"
                loading={isSubmitting}
                disabled={!canSubmit}
              >
                {t(isEdit ? 'actions.save' : 'actions.create')}
              </Button>
            </>
          )}
        </form.Subscribe>
      }
    >
      <form
        id="company-form"
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
              label={t('company.fields.name')}
              required
              error={errorText(field.state.meta.errors[0])}
            >
              <Input
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder={t('company.fields.namePlaceholder')}
                autoFocus
              />
            </Field>
          )}
        </form.Field>

        <form.Field name="contactEmail">
          {(field) => (
            <Field
              label={t('company.fields.contactEmail')}
              required
              error={errorText(field.state.meta.errors[0])}
            >
              <Input
                type="email"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder={t('company.fields.contactEmailPlaceholder')}
              />
            </Field>
          )}
        </form.Field>

        <form.Field name="notificationChannel">
          {(field) => (
            <Field label={t('company.fields.notificationChannel')}>
              <Select
                value={field.state.value}
                onChange={(event) =>
                  field.handleChange(event.target.value as NotificationChannel)
                }
                options={MODAL_NOTIFICATION_CHANNELS.map((value) => ({
                  value,
                  label: t(`company.channels.${value}`),
                }))}
              />
            </Field>
          )}
        </form.Field>
      </form>
    </Modal>
  )
}
