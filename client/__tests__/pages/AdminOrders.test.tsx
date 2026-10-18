import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { LocaleProvider } from '../../i18n/context.js'
import { ApiError } from '../../api/client.js'
import type { AdminOrderSummary } from '../../../shared/admin.js'

vi.mock('../../api/admin.js', () => ({ listAdminOrders: vi.fn() }))
import { listAdminOrders } from '../../api/admin.js'
const listMock = vi.mocked(listAdminOrders)

const { AdminOrders } = await import('../../pages/AdminOrders.js')

const summary = (overrides: Partial<AdminOrderSummary> = {}): AdminOrderSummary => ({
  reference: 'BMS-0000ABCD', email: 'buyer@b.test', status: 'failed', plan: 'lifetime',
  country: 'US', priceCents: 2000, currency: 'EUR', attempts: 1, lastError: 'boom',
  createdAt: '2026-10-18T10:00:00.000Z', paidAt: null, activatedAt: null, ...overrides,
})

const renderPage = () =>
  render(<LocaleProvider><MemoryRouter><AdminOrders /></MemoryRouter></LocaleProvider>)

beforeEach(() => { vi.clearAllMocks() })

describe('AdminOrders', () => {
  it('shows a loading note then the list', async () => {
    listMock.mockResolvedValue({ orders: [summary()] })
    renderPage()
    expect(screen.getByText('Loading orders…')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'BMS-0000ABCD' })).toHaveAttribute('href', '/admin/orders/BMS-0000ABCD')
    expect(listMock).toHaveBeenCalledWith({ limit: 100 }, expect.anything())
  })

  it('refetches when the status filter changes', async () => {
    listMock.mockResolvedValue({ orders: [summary()] })
    renderPage()
    await screen.findByRole('link', { name: 'BMS-0000ABCD' })
    await userEvent.selectOptions(screen.getByLabelText('Filter by status'), 'needs_action')
    expect(listMock).toHaveBeenLastCalledWith({ status: 'needs_action', limit: 100 }, expect.anything())
  })

  it('stays loading when the request is aborted', async () => {
    listMock.mockRejectedValue(new DOMException('aborted', 'AbortError'))
    renderPage()
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(screen.getByText('Loading orders…')).toBeInTheDocument()
  })

  it('tells when nothing matches', async () => {
    listMock.mockResolvedValue({ orders: [] })
    renderPage()
    expect(await screen.findByText('No orders match this filter yet.')).toBeInTheDocument()
  })

  it('shows an error and retries', async () => {
    listMock.mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'Server is down', null))
    renderPage()
    expect(await screen.findByText('Server is down')).toBeInTheDocument()
    listMock.mockResolvedValue({ orders: [summary({ reference: 'BMS-0000WXYZ' })] })
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    const row = (await screen.findByRole('link', { name: 'BMS-0000WXYZ' })).closest('tr') as HTMLElement
    expect(within(row).getByText('Could not be completed')).toBeInTheDocument()
  })
})
