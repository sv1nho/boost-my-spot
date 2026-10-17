import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../i18n/context.js'

const LINGER = 8000

type ToastProps = {
  message: string
  onUndo?: () => void
  onDismiss: () => void
}

export function Toast ({ message, onUndo, onDismiss }: ToastProps) {
  const t = useT()

  useEffect(() => {
    const timer = setTimeout(onDismiss, LINGER)
    return () => { clearTimeout(timer) }
  }, [onDismiss])

  return createPortal(
    <div className='toast' role='status'>
      <span className='toast-message'>{message}</span>
      {onUndo !== undefined && (
        <button type='button' className='btn btn-ghost btn-compact' onClick={onUndo}>
          {t('Undo')}
        </button>
      )}
      <button
        type='button'
        className='icon-btn'
        aria-label={t('Close')}
        onClick={onDismiss}
      >
        ×
      </button>
    </div>,
    document.body
  )
}
