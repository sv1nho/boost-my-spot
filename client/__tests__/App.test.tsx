import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
let session: { data: unknown; isPending: boolean } = { data: null, isPending: false }
vi.mock('../auth/client.js', () => ({
  useSession: () => session,
  signIn: { social: vi.fn() },
  signOut: () => Promise.resolve(),
}))
vi.mock('../api/admin.js', () => ({
  listAdminOrders: () => Promise.resolve({ orders: [] }),
  getAdminOrder: () => Promise.resolve({
    reference: 'BMS-0000ABCD', email: 'a@b.test', status: 'paid', plan: 'lifetime', country: 'US',
    priceCents: 2000, currency: 'EUR', attempts: 0, lastError: null,
    createdAt: '2026-10-18T10:00:00.000Z', paidAt: null, activatedAt: null,
    locale: 'en', spotifyAccount: null, hasCookie: false, hasKey: false,
    nextAttemptAt: null, expiresAt: null, updatedAt: '2026-10-18T10:00:00.000Z', events: [],
  }),
  getKeyStats: () => Promise.resolve({ keys: [] }),
  runAdminAction: vi.fn(),
  importKeys: vi.fn(),
  listPromos: () => Promise.resolve({ promos: [] }),
  createPromo: vi.fn(),
  setPromoActive: vi.fn(),
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

describe('back-office routes', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: () => Promise.resolve({ providers: [] }) } as unknown as Response)
  })
  afterEach(() => { vi.restoreAllMocks(); session = { data: null, isPending: false } })

  it('loads the login page', async () => {
    session = { data: null, isPending: false }
    renderAt('/login')
    expect(await screen.findByText('Back-office sign in')).toBeInTheDocument()
  })

  it.each([
    ['/admin', 'No orders match this filter yet.'],
    ['/admin/orders/BMS-0000ABCD', 'BMS-0000ABCD'],
    ['/admin/keys', 'Upgrade keys'],
    ['/admin/promos', 'No promo codes yet.'],
  ])('loads %s when signed in', async (path, text) => {
    session = { data: { user: { email: 'a@b.test' } }, isPending: false }
    renderAt(path)
    expect(await screen.findByText(text)).toBeInTheDocument()
  })
})
