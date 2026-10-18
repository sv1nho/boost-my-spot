import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useParams } from 'react-router'
import { getAdminOrder, runAdminAction } from '../api/admin.js'
import { errorMessage, isAbort, refusalMessage } from '../api/client.js'
import { StatusPill } from '../orders/StatusPill.js'
import { statusLabel } from '../orders/progress.js'
import { PendingNote } from '../components/PendingNote.js'
import { ConfirmDialog } from '../components/ConfirmDialog.js'
import { useT } from '../i18n/context.js'
import type { AdminAction, AdminOrderDetail as Detail } from '../../shared/admin.js'
import type { OrderStatus } from '../../shared/order-status.js'

const ACTION_LABELS: Record<AdminAction, string> = {
  retry: 'Relaunch the order',
  confirm_payment: 'Confirm the payment',
  refund: 'Mark refunded',
}

const availableActions = (status: OrderStatus): AdminAction[] => {
  const actions: AdminAction[] = []
  if (status === 'failed') actions.push('retry')
  if (status === 'underpaid') actions.push('confirm_payment')
  if (status === 'underpaid' || status === 'needs_action' || status === 'failed') actions.push('refund')
  return actions
}

const dt = (iso: string): string => new Date(iso).toISOString().slice(0, 16).replace('T', ' ')
const money = (cents: number, currency: string): string =>
  new Intl.NumberFormat('en', { style: 'currency', currency }).format(cents / 100)

export function AdminOrderDetail () {
  const t = useT()
  const reference = useParams().reference ?? ''

  const [order, setOrder] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    getAdminOrder(reference, controller.signal)
      .then((data) => { setOrder(data); setError(null) })
      .catch((cause: unknown) => { if (!isAbort(cause)) setError(errorMessage(cause)) })
    return () => { controller.abort() }
  }, [reference, reloadKey])

  const retry = (): void => { setOrder(null); setError(null); setReloadKey((key) => key + 1) }

  const perform = (action: AdminAction): void => {
    setActing(true)
    setNotice(null)
    runAdminAction(reference, action)
      .then((updated) => { setOrder(updated); setConfirming(false); setActing(false); setNotice(t('Done.')) })
      .catch((cause: unknown) => { setNotice(refusalMessage(cause)); setConfirming(false); setActing(false) })
  }

  if (error !== null) {
    return (
      <div className='card space-y-3'>
        <div className='alert-error'>{error}</div>
        <button type='button' className='link-button' onClick={retry}>{t('Try again')}</button>
      </div>
    )
  }

  if (order === null) return <PendingNote label={t('Loading the order…')} />

  const row = (label: string, value: ReactNode): ReactNode => (
    <div className='detail-row'>
      <span className='detail-label'>{t(label)}</span>
      <span className='detail-value'>{value}</span>
    </div>
  )

  const actions = availableActions(order.status)

  return (
    <div className='card space-y-6'>
      <div className='card-header'>
        <h2 className='card-title'>{order.reference}</h2>
        <StatusPill status={order.status} />
      </div>

      <div className='detail-list'>
        {row('Email', order.email)}
        {row('Plan', order.plan)}
        {row('Country', order.country)}
        {row('Price', money(order.priceCents, order.currency))}
        {row('Language', order.locale)}
        {row('Spotify account', order.spotifyAccount ?? '—')}
        {row('Session cookie', order.hasCookie ? t('Held') : t('None'))}
        {row('Upgrade key', order.hasKey ? t('Assigned') : t('None'))}
        {row('Attempts', String(order.attempts))}
        {order.lastError !== null && row('Last error', order.lastError)}
        {row('Created', dt(order.createdAt))}
        {order.paidAt !== null && row('Paid', dt(order.paidAt))}
        {order.activatedAt !== null && row('Activated', dt(order.activatedAt))}
      </div>

      {notice !== null && <div className='alert-info'>{notice}</div>}

      {actions.length > 0 && (
        <div className='admin-actions'>
          {actions.map((action) => (
            <button
              key={action}
              type='button'
              className={action === 'refund' ? 'btn btn-danger' : 'btn btn-primary'}
              disabled={acting}
              onClick={() => { if (action === 'refund') { setConfirming(true) } else { perform(action) } }}
            >
              {t(ACTION_LABELS[action])}
            </button>
          ))}
        </div>
      )}

      <div className='space-y-2'>
        <h3 className='card-subtitle'>{t('History')}</h3>
        <ul className='event-list'>
          {order.events.map((event) => (
            <li key={event.id} className='event-item'>
              <span className='event-time'>{dt(event.at)}</span>
              <span className='event-status'>{t(statusLabel(event.status))}</span>
              <span className='event-actor'>{event.actor}</span>
              {event.note !== null && <span className='event-note'>{event.note}</span>}
            </li>
          ))}
        </ul>
      </div>

      {confirming && (
        <ConfirmDialog
          title={t('Mark this order refunded?')}
          body={t('This closes the order as refunded. It cannot be undone from here.')}
          confirmLabel={t('Mark refunded')}
          pending={acting}
          onConfirm={() => { perform('refund') }}
          onCancel={() => { setConfirming(false) }}
        />
      )}
    </div>
  )
}
