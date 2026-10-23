import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { LocaleProvider } from '../../i18n/context.js'
import { ApiError } from '../../api/client.js'
import { Order } from '../../pages/Order.js'

vi.mock('../../api/catalog.js', () => ({ getCatalog: vi.fn() }))
vi.mock('../../api/orders.js', () => ({ createOrder: vi.fn() }))
vi.mock('../../api/promo.js', () => ({ previewPromo: vi.fn() }))

import { getCatalog } from '../../api/catalog.js'
import { createOrder } from '../../api/orders.js'
import { previewPromo } from '../../api/promo.js'

const getCatalogMock = vi.mocked(getCatalog)
const createOrderMock = vi.mocked(createOrder)
const previewPromoMock = vi.mocked(previewPromo)

const catalog = {
  plans: [{ id: 'lifetime' as const, label: 'Lifetime', priceCents: 3000, compareAtCents: 6000, currency: 'EUR' }],
  countries: ['US', 'GB'],
}

const renderOrder = () => render(
  <LocaleProvider>
    <MemoryRouter initialEntries={['/order']}>
      <Routes>
        <Route path='/order' element={<Order />} />
        <Route path='/orders/:token' element={<div>tracking page</div>} />
      </Routes>
    </MemoryRouter>
  </LocaleProvider>
)
const continueButton = () => screen.getByRole('button', { name: 'Continue' })

const advanceToReview = async () => {
  await screen.findByText('Order your upgrade')
  await userEvent.selectOptions(screen.getByLabelText('Country'), 'US')
  await userEvent.click(continueButton())
  await userEvent.type(screen.getByLabelText('Spotify session key'), 'AQA-cookie-value-123')
  await userEvent.click(continueButton())
  await userEvent.type(screen.getByLabelText('Email'), 'buyer@example.com')
  await userEvent.click(screen.getByLabelText(/accept the terms/i))
  await userEvent.click(screen.getByLabelText(/right away/i))
  await userEvent.click(continueButton())
  await screen.findByText('Review your order')
}

beforeEach(() => { vi.clearAllMocks() })

describe('Order wizard', () => {
  it('shows a loader, then the first step', async () => {
    getCatalogMock.mockResolvedValue(catalog)
    renderOrder()
    expect(screen.getByText('Loading the offer…')).toBeInTheDocument()
    expect(await screen.findByText('Order your upgrade')).toBeInTheDocument()
    expect(screen.getByText('€30.00')).toBeInTheDocument()
    expect(screen.getByText('€60.00')).toBeInTheDocument()
    expect(screen.getByText(/50%/)).toBeInTheDocument()
    expect(screen.getByLabelText('Country')).toBeInTheDocument()
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

  it('blocks each step until it is valid', async () => {
    getCatalogMock.mockResolvedValue(catalog)
    renderOrder()
    await screen.findByText('Order your upgrade')

    await userEvent.click(continueButton())
    await userEvent.click(continueButton())
    expect(screen.getByText('Paste your Spotify session key.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Spotify session key'), 'AQA-cookie-value-123')
    await userEvent.click(continueButton())
    await userEvent.click(continueButton())
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Please accept the terms to continue.')).toBeInTheDocument()
    expect(screen.getByText('Please confirm you want your upgrade right away.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByLabelText('Spotify session key')).toBeInTheDocument()
  })

  it('opens and closes the session-key guide', async () => {
    getCatalogMock.mockResolvedValue(catalog)
    renderOrder()
    await screen.findByText('Order your upgrade')
    await userEvent.click(continueButton())

    await userEvent.click(screen.getByRole('button', { name: 'Where do I find it?' }))
    expect(screen.getByText('Where to find your session key')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(screen.queryByText('Where to find your session key')).not.toBeInTheDocument()
  })

  it('reveals and hides the session key', async () => {
    getCatalogMock.mockResolvedValue(catalog)
    renderOrder()
    await screen.findByText('Order your upgrade')
    await userEvent.click(continueButton())
    const input = screen.getByLabelText('Spotify session key')
    expect(input).toHaveAttribute('type', 'password')
    await userEvent.click(screen.getByRole('button', { name: 'Show' }))
    expect(input).toHaveAttribute('type', 'text')
    await userEvent.click(screen.getByRole('button', { name: 'Hide' }))
    expect(input).toHaveAttribute('type', 'password')
  })

  it('reviews the order and pays', async () => {
    getCatalogMock.mockResolvedValue(catalog)
    createOrderMock.mockResolvedValue({ token: 'tok', paymentUrl: 'https://pay.test/1' })
    const assign = vi.fn()
    Object.defineProperty(window, 'location', { configurable: true, value: { assign } })
    renderOrder()
    await advanceToReview()

    expect(screen.getByText('buyer@example.com')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Pay securely' }))
    expect(createOrderMock).toHaveBeenCalledWith({
      plan: 'lifetime', country: 'US', email: 'buyer@example.com', spDc: 'AQA-cookie-value-123', locale: 'en',
    })
    await waitFor(() => { expect(assign).toHaveBeenCalledWith('https://pay.test/1') })
  })

  it('disables the pay button while submitting', async () => {
    getCatalogMock.mockResolvedValue(catalog)
    createOrderMock.mockReturnValue(new Promise(() => {}))
    renderOrder()
    await advanceToReview()
    await userEvent.click(screen.getByRole('button', { name: 'Pay securely' }))
    expect(screen.getByRole('button', { name: 'Starting…' })).toBeDisabled()
  })

  it('shows a service refusal', async () => {
    getCatalogMock.mockResolvedValue(catalog)
    createOrderMock.mockRejectedValue(new ApiError(409, 'CONFLICT', 'That country is out of stock right now.', null))
    renderOrder()
    await advanceToReview()
    await userEvent.click(screen.getByRole('button', { name: 'Pay securely' }))
    expect(await screen.findByText('That country is out of stock right now.')).toBeInTheDocument()
  })

  it('shows a generic message when the network fails', async () => {
    getCatalogMock.mockResolvedValue(catalog)
    createOrderMock.mockRejectedValue(new Error('offline'))
    renderOrder()
    await advanceToReview()
    await userEvent.click(screen.getByRole('button', { name: 'Pay securely' }))
    expect(await screen.findByText(/could not be reached/i)).toBeInTheDocument()
  })

  it('applies a promo and charges the discounted total', async () => {
    getCatalogMock.mockResolvedValue(catalog)
    createOrderMock.mockResolvedValue({ token: 'tok', paymentUrl: 'https://pay.test/1' })
    previewPromoMock.mockResolvedValue({ code: 'SAVE25', discountCents: 500, finalCents: 2500 })
    const assign = vi.fn()
    Object.defineProperty(window, 'location', { configurable: true, value: { assign } })
    renderOrder()
    await advanceToReview()

    await userEvent.type(screen.getByLabelText('Promo code'), 'save25')
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(await screen.findByText('Promo code applied.')).toBeInTheDocument()
    expect(previewPromoMock).toHaveBeenCalledWith('save25', 'lifetime')
    expect(screen.getByText('€25.00')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Pay securely' }))
    expect(createOrderMock).toHaveBeenCalledWith(expect.objectContaining({ promoCode: 'SAVE25' }))
  })

  it('offers a free order and goes to the tracking page', async () => {
    getCatalogMock.mockResolvedValue(catalog)
    createOrderMock.mockResolvedValue({ token: 'tok', paymentUrl: null })
    previewPromoMock.mockResolvedValue({ code: 'FREE', discountCents: 2000, finalCents: 0 })
    renderOrder()
    await advanceToReview()

    await userEvent.type(screen.getByLabelText('Promo code'), 'free')
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(await screen.findByText('Free')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Get my free upgrade' }))
    expect(await screen.findByText('tracking page')).toBeInTheDocument()
  })

  it('shows a checking state while validating the code', async () => {
    getCatalogMock.mockResolvedValue(catalog)
    previewPromoMock.mockReturnValue(new Promise(() => {}))
    renderOrder()
    await advanceToReview()
    await userEvent.type(screen.getByLabelText('Promo code'), 'save25')
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(screen.getByRole('button', { name: 'Checking…' })).toBeDisabled()
  })

  it('shows an error for an invalid promo code', async () => {
    getCatalogMock.mockResolvedValue(catalog)
    previewPromoMock.mockRejectedValue(new ApiError(400, 'BAD_REQUEST', 'This promo code cannot be used.', null))
    renderOrder()
    await advanceToReview()
    await userEvent.type(screen.getByLabelText('Promo code'), 'nope')
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(await screen.findByText('This promo code cannot be used.')).toBeInTheDocument()
  })

  it('removes an applied promo', async () => {
    getCatalogMock.mockResolvedValue(catalog)
    previewPromoMock.mockResolvedValue({ code: 'SAVE25', discountCents: 500, finalCents: 1500 })
    renderOrder()
    await advanceToReview()
    await userEvent.type(screen.getByLabelText('Promo code'), 'save25')
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    await screen.findByText('Promo code applied.')
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.getByLabelText('Promo code')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pay securely' })).toBeInTheDocument()
  })
})
