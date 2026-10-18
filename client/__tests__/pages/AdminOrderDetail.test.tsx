import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { LocaleProvider } from '../../i18n/context.js'
import { ApiError } from '../../api/client.js'
import type { AdminOrderDetail as Detail } from '../../../shared/admin.js'

vi.mock('../../api/admin.js', () => ({ getAdminOrder: vi.fn(), runAdminAction: vi.fn() }))
import { getAdminOrder, runAdminAction } from '../../api/admin.js'
const getMock = vi.mocked(getAdminOrder)
const actMock = vi.mocked(runAdminAction)

const { AdminOrderDetail } = await import('../../pages/AdminOrderDetail.js')

const detail = (overrides: Partial<Detail> = {}): Detail => ({
  reference: 'BMS-0000ABCD', email: 'buyer@b.test', status: 'failed', plan: 'lifetime',
  country: 'US', priceCents: 2000, currency: 'EUR', attempts: 2, lastError: 'boom',
  createdAt: '2026-10-18T10:00:00.000Z', paidAt: null, activatedAt: null,
  locale: 'en', spotifyAccount: null, hasCookie: false, hasKey: false,
  nextAttemptAt: null, expiresAt: null, updatedAt: '2026-10-18T10:05:00.000Z',
  events: [
    { id: 'e1', status: 'awaiting_payment', actor: 'system', note: 'Order created', at: '2026-10-18T10:00:00.000Z' },
    { id: 'e2', status: 'failed', actor: 'system', note: null, at: '2026-10-18T10:04:00.000Z' },
  ],
  ...overrides,
})

const renderAt = (reference = 'BMS-0000ABCD') =>
  render(
    <LocaleProvider>
      <RouterProvider router={createMemoryRouter(
        [{ path: '/admin/orders/:reference', element: <AdminOrderDetail /> }],
        { initialEntries: [`/admin/orders/${reference}`] }
      )} />
    </LocaleProvider>
  )

beforeEach(() => { vi.clearAllMocks() })

describe('AdminOrderDetail', () => {
  it('loads and shows the failed order with its actions and events', async () => {
    getMock.mockResolvedValue(detail())
    renderAt()
    expect(screen.getByText('Loading the order…')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'BMS-0000ABCD' })).toBeInTheDocument()
    expect(screen.getByText('buyer@b.test')).toBeInTheDocument()
    expect(screen.getByText('boom')).toBeInTheDocument()
    expect(screen.getByText('Order created')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Relaunch the order' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark refunded' })).toBeInTheDocument()
  })

  it('shows paid-order details with no refund actions', async () => {
    getMock.mockResolvedValue(detail({
      status: 'active', lastError: null, paidAt: '2026-10-18T10:02:00.000Z', activatedAt: '2026-10-18T10:03:00.000Z',
      spotifyAccount: 'u@e.com', hasCookie: true, hasKey: true,
    }))
    renderAt()
    expect(await screen.findByText('u@e.com')).toBeInTheDocument()
    expect(screen.getByText('Held')).toBeInTheDocument()
    expect(screen.getByText('Assigned')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark refunded' })).not.toBeInTheDocument()
  })

  it('relaunches a failed order', async () => {
    getMock.mockResolvedValue(detail())
    actMock.mockResolvedValue(detail({ status: 'paid', lastError: null }))
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Relaunch the order' }))
    expect(actMock).toHaveBeenCalledWith('BMS-0000ABCD', 'retry')
    expect(await screen.findByText('Done.')).toBeInTheDocument()
  })

  it('offers the confirm-payment action for an underpaid order', async () => {
    getMock.mockResolvedValue(detail({ status: 'underpaid', lastError: null }))
    actMock.mockResolvedValue(detail({ status: 'paid' }))
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm the payment' }))
    expect(actMock).toHaveBeenCalledWith('BMS-0000ABCD', 'confirm_payment')
  })

  it('refunds through the confirmation dialog', async () => {
    getMock.mockResolvedValue(detail())
    actMock.mockResolvedValue(detail({ status: 'refunded' }))
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Mark refunded' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark refunded' }))
    expect(actMock).toHaveBeenCalledWith('BMS-0000ABCD', 'refund')
  })

  it('closes the dialog on cancel', async () => {
    getMock.mockResolvedValue(detail())
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Mark refunded' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('surfaces an action refusal', async () => {
    getMock.mockResolvedValue(detail())
    actMock.mockRejectedValue(new ApiError(409, 'CONFLICT', 'Not allowed now', null))
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Relaunch the order' }))
    expect(await screen.findByText('Not allowed now')).toBeInTheDocument()
  })

  it('stays loading when the request is aborted', async () => {
    getMock.mockRejectedValue(new DOMException('aborted', 'AbortError'))
    renderAt()
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(screen.getByText('Loading the order…')).toBeInTheDocument()
  })

  it('falls back to an empty reference without a route param', async () => {
    getMock.mockResolvedValue(detail())
    render(
      <LocaleProvider>
        <RouterProvider router={createMemoryRouter(
          [{ path: '/x', element: <AdminOrderDetail /> }],
          { initialEntries: ['/x'] }
        )} />
      </LocaleProvider>
    )
    await screen.findByRole('heading', { name: 'BMS-0000ABCD' })
    expect(getMock).toHaveBeenCalledWith('', expect.anything())
  })

  it('shows a load error and retries', async () => {
    getMock.mockRejectedValueOnce(new ApiError(404, 'NOT_FOUND', 'Gone', null))
    renderAt()
    expect(await screen.findByText('Gone')).toBeInTheDocument()
    getMock.mockResolvedValue(detail())
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'BMS-0000ABCD' })).toBeInTheDocument()
  })
})
