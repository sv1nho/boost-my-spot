import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { LocaleProvider } from '../../i18n/context.js'
import { ApiError } from '../../api/client.js'
import { Track } from '../../pages/Track.js'

vi.mock('../../api/orders.js', () => ({ lookupOrder: vi.fn() }))
import { lookupOrder } from '../../api/orders.js'
const lookupMock = vi.mocked(lookupOrder)

const renderTrack = () =>
  render(
    <LocaleProvider>
      <MemoryRouter initialEntries={['/track']}>
        <Routes>
          <Route path='/track' element={<Track />} />
          <Route path='/orders/:token' element={<div>tracking page</div>} />
        </Routes>
      </MemoryRouter>
    </LocaleProvider>
  )

beforeEach(() => { vi.clearAllMocks() })

describe('Track page', () => {
  it('validates before looking up', async () => {
    renderTrack()
    await userEvent.click(screen.getByRole('button', { name: 'Find my order' }))
    expect(screen.getByText('Enter your order number.')).toBeInTheDocument()
    expect(lookupMock).not.toHaveBeenCalled()
  })

  it('finds an order and navigates to its tracking page', async () => {
    lookupMock.mockResolvedValue({ token: 'tok' })
    renderTrack()
    await userEvent.type(screen.getByLabelText('Order number'), 'bms-0000abcd')
    await userEvent.type(screen.getByLabelText('Email'), 'buyer@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Find my order' }))
    expect(lookupMock).toHaveBeenCalledWith({ reference: 'BMS-0000ABCD', email: 'buyer@example.com' })
    expect(await screen.findByText('tracking page')).toBeInTheDocument()
  })

  it('shows a refusal when nothing matches', async () => {
    lookupMock.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'No order matches that number and email.', null))
    renderTrack()
    await userEvent.type(screen.getByLabelText('Order number'), 'BMS-0000ABCD')
    await userEvent.type(screen.getByLabelText('Email'), 'buyer@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Find my order' }))
    expect(await screen.findByText('No order matches that number and email.')).toBeInTheDocument()
  })
})
