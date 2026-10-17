import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useEffect } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { LocaleProvider } from '../../i18n/context.js'
import { OrderStatus } from '../../pages/OrderStatus.js'
import type { OrderView } from '../../../shared/order.js'

vi.mock('../../orders/useOrderPolling.js', () => ({ useOrderPolling: vi.fn() }))
vi.mock('../../api/orders.js', () => ({ submitSpotify: vi.fn() }))

import { useOrderPolling } from '../../orders/useOrderPolling.js'
import { submitSpotify } from '../../api/orders.js'

const pollingMock = vi.mocked(useOrderPolling)
const submitMock = vi.mocked(submitSpotify)
const reload = vi.fn()

const makeOrder = (status: OrderView['status']): OrderView => ({
  reference: 'BMS-0000ABCD', status, plan: 'lifetime', country: 'US', priceCents: 2000, currency: 'EUR',
  spotifyAccount: null, lastError: null, createdAt: '2026-10-17T10:00:00.000Z', paidAt: null, activatedAt: null,
})

const renderAt = (entry: string) =>
  render(
    <LocaleProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path='/orders/:token' element={<OrderStatus />} />
        </Routes>
      </MemoryRouter>
    </LocaleProvider>
  )

beforeEach(() => {
  vi.clearAllMocks()
  pollingMock.mockReturnValue({ order: null, error: null, reload })
})

describe('OrderStatus page', () => {
  it('shows a loader while the order is unknown', () => {
    renderAt('/orders/tok')
    expect(screen.getByText('Loading your order…')).toBeInTheDocument()
  })

  it('tolerates a route without a token', () => {
    pollingMock.mockReturnValue({ order: makeOrder('active'), error: null, reload })
    render(
      <LocaleProvider>
        <MemoryRouter initialEntries={['/x']}>
          <Routes><Route path='/x' element={<OrderStatus />} /></Routes>
        </MemoryRouter>
      </LocaleProvider>
    )
    expect(screen.getByText('Your order')).toBeInTheDocument()
  })

  it('shows an error with a retry', async () => {
    pollingMock.mockReturnValue({ order: null, error: 'Server down', reload })
    renderAt('/orders/tok')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(reload).toHaveBeenCalled()
  })

  it('shows the status pill and timeline for an active order', () => {
    pollingMock.mockReturnValue({ order: makeOrder('active'), error: null, reload })
    renderAt('/orders/tok')
    expect(screen.getByText('Premium active', { selector: '.status-pill' })).toBeInTheDocument()
    expect(screen.getByText('BMS-0000ABCD')).toBeInTheDocument()
    expect(screen.getByText('Premium stopped? Renew it')).toBeInTheDocument()
  })

  it('submits a fresh cookie when the order needs action', async () => {
    submitMock.mockResolvedValue(makeOrder('paid'))
    pollingMock.mockReturnValue({ order: makeOrder('needs_action'), error: null, reload })
    renderAt('/orders/tok123')
    await userEvent.type(screen.getByLabelText('Spotify session key'), 'AQA-fresh-cookie-xyz')
    await userEvent.click(screen.getByRole('button', { name: 'Submit the new key' }))
    expect(submitMock).toHaveBeenCalledWith('tok123', 'AQA-fresh-cookie-xyz')
    await waitFor(() => { expect(reload).toHaveBeenCalled() })
  })

  it('reveals the renewal form on an active order', async () => {
    pollingMock.mockReturnValue({ order: makeOrder('active'), error: null, reload })
    renderAt('/orders/tok')
    await userEvent.click(screen.getByRole('button', { name: 'Premium stopped? Renew it' }))
    expect(screen.getByRole('button', { name: 'Renew my Premium' })).toBeInTheDocument()
  })

  it('tells the buyer we are confirming their payment', () => {
    pollingMock.mockReturnValue({ order: makeOrder('awaiting_payment'), error: null, reload })
    renderAt('/orders/tok?paid=1')
    expect(screen.getByText(/confirming your payment/i)).toBeInTheDocument()
  })

  it('copies the order number', async () => {
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    pollingMock.mockReturnValue({ order: makeOrder('active'), error: null, reload })
    renderAt('/orders/tok')
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(writeText).toHaveBeenCalledWith('BMS-0000ABCD')
    expect(screen.getByText('Order number copied.')).toBeInTheDocument()
  })

  it('raises a toast when the status changes to active', async () => {
    pollingMock.mockImplementation(((_token: string, onChange?: (n: string, p: string | null) => void) => {
      useEffect(() => { onChange?.('active', 'upgrading') }, [onChange])
      return { order: makeOrder('active'), error: null, reload }
    }) as unknown as typeof useOrderPolling)
    renderAt('/orders/tok')
    expect(await screen.findByText('Your Premium is active!')).toBeInTheDocument()
  })

  it('stays quiet when the status changes to a plain in-progress one', () => {
    pollingMock.mockImplementation(((_token: string, onChange?: (n: string, p: string | null) => void) => {
      useEffect(() => { onChange?.('paid', 'awaiting_payment') }, [onChange])
      return { order: makeOrder('paid'), error: null, reload }
    }) as unknown as typeof useOrderPolling)
    renderAt('/orders/tok')
    expect(screen.queryByText('Your Premium is active!')).toBeNull()
  })

  it('stays quiet on the very first load', () => {
    pollingMock.mockImplementation(((_token: string, onChange?: (n: string, p: string | null) => void) => {
      useEffect(() => { onChange?.('active', null) }, [onChange])
      return { order: makeOrder('active'), error: null, reload }
    }) as unknown as typeof useOrderPolling)
    renderAt('/orders/tok')
    expect(screen.queryByText('Your Premium is active!')).toBeNull()
  })

  it('warns when the status changes to needs_action', async () => {
    pollingMock.mockImplementation(((_token: string, onChange?: (n: string, p: string | null) => void) => {
      useEffect(() => { onChange?.('needs_action', 'upgrading') }, [onChange])
      return { order: makeOrder('needs_action'), error: null, reload }
    }) as unknown as typeof useOrderPolling)
    renderAt('/orders/tok')
    expect(await screen.findByText('We need your Spotify session key again.')).toBeInTheDocument()
  })

  it('copies even when the clipboard is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    pollingMock.mockReturnValue({ order: makeOrder('active'), error: null, reload })
    renderAt('/orders/tok')
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(screen.getByText('Order number copied.')).toBeInTheDocument()
  })

  it('explains a failed order', () => {
    pollingMock.mockReturnValue({ order: makeOrder('failed'), error: null, reload })
    renderAt('/orders/tok')
    expect(screen.getByText(/could not complete/i)).toBeInTheDocument()
  })

  it('explains a payment that did not go through', () => {
    pollingMock.mockReturnValue({ order: makeOrder('underpaid'), error: null, reload })
    renderAt('/orders/tok')
    expect(screen.getByText(/did not go through/i)).toBeInTheDocument()
  })

  it('shows a refusal when the cookie submission fails', async () => {
    submitMock.mockRejectedValue(new Error('offline'))
    pollingMock.mockReturnValue({ order: makeOrder('needs_action'), error: null, reload })
    renderAt('/orders/tok')
    await userEvent.type(screen.getByLabelText('Spotify session key'), 'AQA-fresh-cookie-xyz')
    await userEvent.click(screen.getByRole('button', { name: 'Submit the new key' }))
    expect(await screen.findByText(/could not be reached/i)).toBeInTheDocument()
  })

  it('dismisses the toast', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn() } })
    pollingMock.mockReturnValue({ order: makeOrder('active'), error: null, reload })
    renderAt('/orders/tok')
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(screen.getByText('Order number copied.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByText('Order number copied.')).toBeNull()
  })
})
