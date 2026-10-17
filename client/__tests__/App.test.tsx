import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { LocaleProvider } from '../i18n/context.js'

vi.mock('../api/catalog.js', () => ({
  getCatalog: () => Promise.resolve({
    plans: [{ id: 'lifetime', label: 'Lifetime', priceCents: 2000, currency: 'EUR' }],
    countries: ['US'],
  }),
}))
vi.mock('../api/orders.js', () => ({
  createOrder: vi.fn(), getOrder: vi.fn(), lookupOrder: vi.fn(), submitSpotify: vi.fn(),
}))
vi.mock('../orders/useOrderPolling.js', () => ({
  useOrderPolling: () => ({
    order: {
      reference: 'BMS-0000ABCD', status: 'active', plan: 'lifetime', country: 'US', priceCents: 2000,
      currency: 'EUR', spotifyAccount: null, lastError: null,
      createdAt: '2026-10-18T10:00:00.000Z', paidAt: null, activatedAt: null,
    },
    error: null,
    reload: vi.fn(),
  }),
}))

import { App, routes } from '../App.js'

const renderAt = (path: string) =>
  render(<LocaleProvider><RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} /></LocaleProvider>)

describe('App routes', () => {
  it.each([
    ['/', 'Spotify Premium, upgraded for you'],
    ['/order', 'Order your upgrade'],
    ['/orders/tok', 'Your order'],
    ['/track', 'Track your order'],
    ['/help', 'Help & FAQ'],
    ['/terms', 'Terms of Service'],
    ['/privacy', /We collect only what the order needs/],
  ])('loads %s', async (path, text: string | RegExp) => {
    renderAt(path)
    expect(await screen.findByText(text)).toBeInTheDocument()
  })

  it('mounts with the browser router', async () => {
    render(<App />)
    expect(await screen.findByText('Spotify Premium, upgraded for you')).toBeInTheDocument()
  })
})
