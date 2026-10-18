import { useT } from '../i18n/context.js'

type ConfirmDialogProps = {
  title: string
  body: string
  confirmLabel: string
  pending: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog ({ title, body, confirmLabel, pending, onConfirm, onCancel }: ConfirmDialogProps) {
  const t = useT()

  return (
    <div className='dialog-overlay' role='dialog' aria-modal='true' aria-label={title}>
      <div className='dialog-card'>
        <h3 className='dialog-title'>{title}</h3>
        <p className='dialog-text'>{body}</p>
        <div className='dialog-actions'>
          <button type='button' className='btn btn-ghost' disabled={pending} onClick={onCancel}>
            {t('Cancel')}
          </button>
          <button type='button' className='btn btn-danger' disabled={pending} onClick={onConfirm}>
            {pending ? t('Working…') : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
