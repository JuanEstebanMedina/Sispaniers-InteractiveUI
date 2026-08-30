import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  dismissible?: boolean
  className?: string
}

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} as const

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissible = true,
  className,
}: ModalProps) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    const handleCancel = (event: Event) => {
      event.preventDefault()
      if (dismissible) onClose()
    }

    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [onClose, dismissible])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={title ? 'modal-title' : undefined}
      onClick={(event) => {
        if (dismissible && event.target === ref.current) onClose()
      }}
      className={cn(
        'w-[calc(100vw-2rem)] max-h-[85dvh] p-0',
        'rounded-lg border border-line bg-surface text-fg shadow-xl',
        'backdrop:bg-overlay backdrop:backdrop-blur-sm',
        'open:animate-slide-up',
        SIZES[size],
        className,
      )}
    >
      <div className="flex max-h-[85dvh] flex-col">
        {(title || dismissible) && (
          <header className="flex items-start justify-between gap-4 border-b border-line px-gutter py-4">
            <div className="min-w-0">
              {title && (
                <h2 id="modal-title" className="text-lg font-semibold text-fg">
                  {title}
                </h2>
              )}
              {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
            </div>
            {dismissible && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                aria-label={t('actions.close')}
                className="-mr-2 -mt-2 shrink-0"
              >
                <X />
              </Button>
            )}
          </header>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-gutter py-4">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-line bg-surface-sunken/50 px-gutter py-4">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  )
}

interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  loading?: boolean
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  loading = false,
}: ConfirmModalProps) {
  const { t } = useTranslation()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      dismissible={!loading}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel ?? t('actions.cancel')}
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>
            {confirmLabel ?? t('actions.confirm')}
          </Button>
        </>
      }
    >
      <p className="text-base text-fg-muted">{message}</p>
    </Modal>
  )
}
