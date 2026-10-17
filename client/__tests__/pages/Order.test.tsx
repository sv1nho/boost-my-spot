import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LocaleProvider } from '../../i18n/context.js'
import { ApiError } from '../../api/client.js'
import { Order } from '../../pages/Order.js'

vi.mock('../../api/catalog.js', () => ({ getCatalog: vi.fn() }))
vi.mock('../../api/orders.js', () => ({ createOrder: vi.fn() }))

import { getCatalog } from '../../api/catalog.js'
import { createOrder } from '../../api/orders.js'

const getCatalogMock = vi.mocked(getCatalog)
const createOrderMock = vi.mocked(createOrder)

const catalog = {
  plans: [{ id: 'lifetime' as const, label: 'Lifetime', priceCents: 2000, currency: 'EUR' }],
  countries: ['US', 'GB'],
}

const renderOrder = () => render(<LocaleProvider><Order /></LocaleProvider>)

const fillValid = async () => {
  await userEvent.type(screen.getByLabelText('Email'), 'buyer@example.com')
  await userEvent.type(screen.getByLabelText('Spotify session key'), 'AQA-cookie-value-123')
  await userEvent.click(screen.getByLabelText(/accept the terms/i))
  await userEvent.click(screen.getByLabelText(/right away/i))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Order page', () => {
  it('shows a loader, then the offer', async () => {
    getCatalogMock.mockResolvedValue(catalog)
    renderOrder()
    expect(screen.getByText('Loading the offer…')).toBeInTheDocument()
    expect(await screen.findByText('Order your upgrade')).toBeInTheDocument()
    expect(screen.getByText('€20.00')).toBeInTheDocument()
  })

  it('shows an error and recovers on retry', async () => {
    getCatalogMock.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(catalog)
    renderOrder()
    expect(await screen.findByText(/could not be reached/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Order your upgrade')).toBeInTheDocument()
  })

  it('ignores an aborted load without showing an error', async () => {
    getCatalogMock.mockRejectedValue(new DOMException('aborted', 'AbortError'))
    renderOrder()
    await waitFor(() => { expect(getCatalogMock).toHaveBeenCalled() })
    expect(screen.getByText('Loading the offer…')).toBeInTheDocument()
  })

  it('validates the form before submitting', async () => {
    getCatalogMock.mockResolvedValue(catalog)
    renderOrder()
    await screen.findByText('Order your upgrade')
    await userEvent.click(screen.getByRole('button', { name: 'Pay with crypto' }))
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Paste your Spotify session key.')).toBeInTheDocument()
    expect(screen.getByText('Please accept the terms to continue.')).toBeInTheDocument()
    expect(createOrderMock).not.toHaveBeenCalled()
  })

  it('creates the order and redirects to the payment page', async () => {
    getCatalogMock.mockResolvedValue(catalog)
    createOrderMock.mockResolvedValue({ token: 'tok', paymentUrl: 'https://pay.test/1' })
    const assign = vi.fn()
    Object.defineProperty(window, 'location', { configurable: true, value: { assign } })
    renderOrder()
    await screen.findByText('Order your upgrade')
    await userEvent.selectOptions(screen.getByLabelText('Country'), 'US')
    await fillValid()
    await userEvent.click(screen.getByRole('button', { name: 'Pay with crypto' }))
    expect(createOrderMock).toHaveBeenCalledWith({
      plan: 'lifetime', country: 'US', email: 'buyer@example.com', spDc: 'AQA-cookie-value-123', locale: 'en',
    })
    await waitFor(() => { expect(assign).toHaveBeenCalledWith('https://pay.test/1') })
  })

  it('shows a service refusal', async () => {
    getCatalogMock.mockResolvedValue(catalog)
    createOrderMock.mockRejectedValue(new ApiError(409, 'CONFLICT', 'That country is out of stock right now.', null))
    renderOrder()
    await screen.findByText('Order your upgrade')
    await fillValid()
    await userEvent.click(screen.getByRole('button', { name: 'Pay with crypto' }))
    expect(await screen.findByText('That country is out of stock right now.')).toBeInTheDocument()
  })

  it('reveals and hides the session key', async () => {
    getCatalogMock.mockResolvedValue(catalog)
    renderOrder()
    await screen.findByText('Order your upgrade')
    const input = screen.getByLabelText('Spotify session key')
    expect(input).toHaveAttribute('type', 'password')
    await userEvent.click(screen.getByRole('button', { name: 'Show' }))
    expect(input).toHaveAttribute('type', 'text')
    await userEvent.click(screen.getByRole('button', { name: 'Hide' }))
    expect(input).toHaveAttribute('type', 'password')
  })
})
