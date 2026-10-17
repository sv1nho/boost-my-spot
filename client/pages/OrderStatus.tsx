import { useCallback, useState } from 'react'
import type { ReactElement } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { PendingNote } from '../components/PendingNote.js'
import { Toast } from '../components/Toast.js'
import { StatusPill } from '../orders/StatusPill.js'
import { OrderTimeline } from '../orders/OrderTimeline.js'
import { SpotifyKeyField } from '../orders/SpotifyKeyField.js'
import { useOrderPolling } from '../orders/useOrderPolling.js'
import { submitSpotify } from '../api/orders.js'
import { refusalMessage } from '../api/client.js'
import { useT } from '../i18n/context.js'
import type { OrderStatus as Status } from '../../shared/order-status.js'

export function OrderStatus () {
  const t = useT()
  const params = useParams()
  const [search] = useSearchParams()
  const token = params.token ?? ''

  const [notice, setNotice] = useState<string | null>(null)
  const onChange = useCallback((next: Status, previous: Status | null) => {
    if (previous === null) return
    if (next === 'active') setNotice(t('Your Premium is active!'))
    else if (next === 'needs_action') setNotice(t('We need your Spotify session key again.'))
  }, [t])

  const { order, error, reload } = useOrderPolling(token, onChange)

  const [spDc, setSpDc] = useState('')
  const [renewing, setRenewing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const submit = (): void => {
    setSubmitting(true)
    setSubmitError(null)
    submitSpotify(token, spDc)
      .then(() => { setSubmitting(false); setSpDc(''); setRenewing(false); reload() })
      .catch((cause: unknown) => { setSubmitError(refusalMessage(cause)); setSubmitting(false) })
  }

  const copy = (reference: string): void => {
    void navigator.clipboard?.writeText(reference)
    setNotice(t('Order number copied.'))
  }

  const keyForm = (cta: string): ReactElement => (
    <form className='space-y-3' onSubmit={(event) => { event.preventDefault(); submit() }} noValidate>
      <SpotifyKeyField id='status-spdc' value={spDc} problem={undefined} onChange={setSpDc} />
      {submitError !== null && <div className='alert-error'>{submitError}</div>}
      <button type='submit' className='btn btn-primary' disabled={submitting || spDc.trim().length < 10}>
        {submitting ? t('Sending…') : cta}
      </button>
    </form>
  )

  if (order === null) {
    return error === null
      ? <PendingNote label={t('Loading your order…')} />
      : (
        <div className='card'>
          <div className='alert-error'>{error}</div>
          <button type='button' className='link-button' onClick={reload}>{t('Try again')}</button>
        </div>
        )
  }

  const confirming = search.get('paid') === '1' && order.status === 'awaiting_payment'

  return (
    <div className='card space-y-6'>
      <div className='card-header'>
        <h3 className='card-title'>{t('Your order')}</h3>
        <StatusPill status={order.status} />
      </div>

      <div className='detail-row'>
        <span className='detail-value'>{order.reference}</span>
        <button type='button' className='btn btn-ghost btn-compact' onClick={() => { copy(order.reference) }}>{t('Copy')}</button>
      </div>

      <OrderTimeline status={order.status} />

      {confirming && <p className='card-text'>{t('Confirming your payment… this can take a few minutes.')}</p>}

      {order.status === 'needs_action' && (
        <div className='space-y-3'>
          <p className='card-text'>{t('Your session key was rejected. Paste a fresh one to continue.')}</p>
          {keyForm(t('Submit the new key'))}
        </div>
      )}

      {order.status === 'active' && (
        <div className='space-y-3'>
          <p className='card-text'>{t('Tip: sign out of Spotify everywhere else to keep this session yours.')}</p>
          {renewing
            ? keyForm(t('Renew my Premium'))
            : (
              <button type='button' className='link-button' onClick={() => { setRenewing(true) }}>
                {t('Premium stopped? Renew it')}
              </button>
              )}
        </div>
      )}

      {order.status === 'failed' && (
        <p className='card-text'>{t('We could not complete this upgrade. Our team will reach out about a refund.')}</p>
      )}

      {(order.status === 'expired' || order.status === 'underpaid') && (
        <p className='card-text'>{t('The payment did not go through. You can start a new order.')}</p>
      )}

      {notice !== null && <Toast message={notice} onDismiss={() => { setNotice(null) }} />}
    </div>
  )
}
