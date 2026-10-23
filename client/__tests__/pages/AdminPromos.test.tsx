import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LocaleProvider } from '../../i18n/context.js'
import { ApiError } from '../../api/client.js'
import type { PromoSummary } from '../../../shared/admin.js'

vi.mock('../../api/admin.js', () => ({ listPromos: vi.fn(), createPromo: vi.fn(), setPromoActive: vi.fn() }))
import { listPromos, createPromo, setPromoActive } from '../../api/admin.js'
const listMock = vi.mocked(listPromos)
const createMock = vi.mocked(createPromo)
const toggleMock = vi.mocked(setPromoActive)

const { AdminPromos } = await import('../../pages/AdminPromos.js')

const promo = (overrides: Partial<PromoSummary> = {}): PromoSummary => ({
  id: 'p1', code: 'SAVE25', kind: 'percent', value: 25, active: true,
  expiresAt: null, maxRedemptions: null, redemptions: 0, createdAt: '2026-10-23T10:00:00.000Z', ...overrides,
})

const renderPage = () => render(<LocaleProvider><AdminPromos /></LocaleProvider>)
const createButton = () => screen.getByRole('button', { name: 'Create a promo code' })

beforeEach(() => { vi.clearAllMocks(); listMock.mockResolvedValue({ promos: [] }) })

describe('AdminPromos', () => {
  it('loads then shows a percentage promo', async () => {
    listMock.mockResolvedValue({ promos: [promo()] })
    renderPage()
    expect(screen.getByText('Loading promo codes…')).toBeInTheDocument()
    const table = await screen.findByRole('table')
    expect(within(table).getByText('SAVE25')).toBeInTheDocument()
    expect(within(table).getByText('25%')).toBeInTheDocument()
    expect(within(table).getByText('—')).toBeInTheDocument()
    expect(within(table).getByRole('button', { name: 'Active' })).toBeInTheDocument()
  })

  it('shows an amount promo with an expiry and a cap', async () => {
    listMock.mockResolvedValue({ promos: [promo({ kind: 'amount', value: 500, active: false, expiresAt: '2026-12-31T00:00:00.000Z', maxRedemptions: 10, redemptions: 3 })] })
    renderPage()
    const table = await screen.findByRole('table')
    expect(within(table).getByText('€5.00')).toBeInTheDocument()
    expect(within(table).getByText('3 / 10')).toBeInTheDocument()
    expect(within(table).getByText('2026-12-31')).toBeInTheDocument()
    expect(within(table).getByRole('button', { name: 'Inactive' })).toBeInTheDocument()
  })

  it('tells when there are none', async () => {
    renderPage()
    expect(await screen.findByText('No promo codes yet.')).toBeInTheDocument()
  })

  it('stays loading when the request is aborted', async () => {
    listMock.mockRejectedValue(new DOMException('aborted', 'AbortError'))
    renderPage()
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(screen.getByText('Loading promo codes…')).toBeInTheDocument()
  })

  it('shows a load error and retries', async () => {
    listMock.mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'Down', null))
    renderPage()
    expect(await screen.findByText('Down')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('No promo codes yet.')).toBeInTheDocument()
  })

  it('creates a percentage promo', async () => {
    createMock.mockResolvedValue(promo())
    renderPage()
    await screen.findByText('No promo codes yet.')
    await userEvent.type(screen.getByLabelText('Code'), 'HALLOWEEN')
    await userEvent.type(screen.getByLabelText('Percent (1–100)'), '25')
    await userEvent.click(createButton())
    expect(createMock).toHaveBeenCalledWith({ code: 'HALLOWEEN', kind: 'percent', value: 25 })
  })

  it('creates an amount promo with an expiry and a cap', async () => {
    createMock.mockResolvedValue(promo())
    renderPage()
    await screen.findByText('No promo codes yet.')
    await userEvent.type(screen.getByLabelText('Code'), 'XMAS')
    await userEvent.selectOptions(screen.getByLabelText('Discount'), 'amount')
    await userEvent.type(screen.getByLabelText('Cents off'), '500')
    await userEvent.type(screen.getByLabelText('Expiry (optional)'), '2026-12-31')
    await userEvent.type(screen.getByLabelText('Max uses (optional)'), '10')
    await userEvent.click(createButton())
    expect(createMock).toHaveBeenCalledWith({
      code: 'XMAS', kind: 'amount', value: 500, expiresAt: new Date('2026-12-31').toISOString(), maxRedemptions: 10,
    })
  })

  it('keeps the create button disabled until the inputs are valid', async () => {
    renderPage()
    await screen.findByText('No promo codes yet.')
    expect(createButton()).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Code'), 'X')
    expect(createButton()).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Percent (1–100)'), '150')
    expect(createButton()).toBeDisabled()
  })

  it('shows a create failure', async () => {
    createMock.mockRejectedValue(new ApiError(409, 'CONFLICT', 'A promo code with that name already exists.', null))
    renderPage()
    await screen.findByText('No promo codes yet.')
    await userEvent.type(screen.getByLabelText('Code'), 'DUP')
    await userEvent.type(screen.getByLabelText('Percent (1–100)'), '25')
    await userEvent.click(createButton())
    expect(await screen.findByText('A promo code with that name already exists.')).toBeInTheDocument()
  })

  it('toggles a promo active flag', async () => {
    listMock.mockResolvedValue({ promos: [promo()] })
    toggleMock.mockResolvedValue(promo({ active: false }))
    renderPage()
    await screen.findByRole('table')
    await userEvent.click(screen.getByRole('button', { name: 'Active' }))
    expect(toggleMock).toHaveBeenCalledWith('p1', false)
  })

  it('surfaces a toggle failure', async () => {
    listMock.mockResolvedValue({ promos: [promo()] })
    toggleMock.mockRejectedValue(new ApiError(500, 'INTERNAL_ERROR', 'Toggle failed', null))
    renderPage()
    await screen.findByRole('table')
    await userEvent.click(screen.getByRole('button', { name: 'Active' }))
    expect(await screen.findByText('Toggle failed')).toBeInTheDocument()
  })
})
