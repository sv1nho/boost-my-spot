import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { listAdminOrders } from '../api/admin.js'
import { errorMessage, isAbort } from '../api/client.js'
import { StatusPill } from '../orders/StatusPill.js'
import { PendingNote } from '../components/PendingNote.js'
import { useT } from '../i18n/context.js'
import { ORDER_STATUSES } from '../../shared/order-status.js'
import { statusLabel } from '../orders/progress.js'
import type { AdminOrderSummary } from '../../shared/admin.js'
import type { OrderStatus } from '../../shared/order-status.js'

const money = (cents: number, currency: string): string =>
  new Intl.NumberFormat('en', { style: 'currency', currency }).format(cents / 100)

const day = (iso: string): string => new Date(iso).toISOString().slice(0, 10)

export function AdminOrders () {
  const t = useT()
  const [status, setStatus] = useState<OrderStatus | ''>('')
  const [orders, setOrders] = useState<AdminOrderSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    listAdminOrders({ status: status === '' ? undefined : status, limit: 100 }, controller.signal)
      .then((data) => { setOrders(data.orders); setError(null) })
      .catch((cause: unknown) => { if (!isAbort(cause)) setError(errorMessage(cause)) })
    return () => { controller.abort() }
  }, [status, reloadKey])

  const onFilter = (next: OrderStatus | ''): void => { setOrders(null); setError(null); setStatus(next) }
  const retry = (): void => { setOrders(null); setError(null); setReloadKey((key) => key + 1) }

  return (
    <div className='card space-y-4'>
      <div className='card-header'>
        <h2 className='card-title'>{t('Orders')}</h2>
        <select
          className='form-select admin-filter'
          value={status}
          aria-label={t('Filter by status')}
          onChange={(event) => { onFilter(event.target.value as OrderStatus | '') }}
        >
          <option value=''>{t('All statuses')}</option>
          {ORDER_STATUSES.map((value) => (
            <option key={value} value={value}>{t(statusLabel(value))}</option>
          ))}
        </select>
      </div>

      {error !== null && (
        <div className='space-y-3'>
          <div className='alert-error'>{error}</div>
          <button type='button' className='link-button' onClick={retry}>{t('Try again')}</button>
        </div>
      )}

      {error === null && orders === null && <PendingNote label={t('Loading orders…')} />}

      {error === null && orders !== null && orders.length === 0 && (
        <p className='card-text'>{t('No orders match this filter yet.')}</p>
      )}

      {error === null && orders !== null && orders.length > 0 && (
        <div className='admin-table-wrap'>
          <table className='admin-table'>
            <thead>
              <tr>
                <th>{t('Reference')}</th>
                <th>{t('Status')}</th>
                <th>{t('Email')}</th>
                <th>{t('Country')}</th>
                <th>{t('Price')}</th>
                <th>{t('Created')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.reference}>
                  <td><Link className='link' to={`/admin/orders/${order.reference}`}>{order.reference}</Link></td>
                  <td><StatusPill status={order.status} /></td>
                  <td className='admin-cell-email'>{order.email}</td>
                  <td>{order.country}</td>
                  <td>{money(order.priceCents, order.currency)}</td>
                  <td>{day(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
