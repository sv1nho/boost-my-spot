import { describe, it, expect } from 'vitest'
import { toOrderView, toCatalog } from '../../../services/orders/mapper.js'

const row = {
  reference: 'BMS-0000ABCD',
  status: 'paid',
  plan: 'lifetime',
  country: 'US',
  priceCents: 2000,
  currency: 'EUR',
  spotifyAccount: 'u@e.com',
  lastError: null,
  createdAt: new Date('2026-10-12T10:00:00.000Z'),
  paidAt: new Date('2026-10-12T10:05:00.000Z'),
  activatedAt: null,
}

describe('order mapper', () => {
  it('maps a row to a view with ISO dates and no cookie field', () => {
    const view = toOrderView(row)
    expect(view).toEqual({
      reference: 'BMS-0000ABCD', status: 'paid', plan: 'lifetime', country: 'US',
      priceCents: 2000, currency: 'EUR', spotifyAccount: 'u@e.com', lastError: null,
      createdAt: '2026-10-12T10:00:00.000Z', paidAt: '2026-10-12T10:05:00.000Z', activatedAt: null,
    })
    expect(Object.keys(view)).not.toContain('spDcSealed')
  })

  it('refuses a row whose stored enums are not recognised', () => {
    expect(() => toOrderView({ ...row, status: 'nope' })).toThrow(/status/)
    expect(() => toOrderView({ ...row, plan: 'nope' })).toThrow(/plan/)
  })

  it('builds the catalog from the plans and the available countries', () => {
    const catalog = toCatalog(['US', 'GB'])
    expect(catalog.plans).toEqual([{ id: 'lifetime', label: 'Lifetime', priceCents: 2000, currency: 'EUR' }])
    expect(catalog.countries).toEqual(['US', 'GB'])
  })
})
