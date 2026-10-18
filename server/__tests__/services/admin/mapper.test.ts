import { describe, it, expect } from 'vitest'
import { toAdminDetail, toAdminSummary, toEventView } from '../../../services/admin/mapper.js'

const base = {
  reference: 'BMS-0000ABCD',
  email: 'buyer@b.test',
  status: 'paid',
  plan: 'lifetime',
  country: 'US',
  priceCents: 2000,
  currency: 'EUR',
  attempts: 1,
  lastError: null,
  createdAt: new Date('2026-10-18T10:00:00.000Z'),
  paidAt: new Date('2026-10-18T10:05:00.000Z'),
  activatedAt: null,
}

const detailRow = {
  ...base,
  locale: 'en',
  spotifyAccount: 'u@e.com',
  spDcSealed: new Uint8Array([1, 2, 3]),
  nextAttemptAt: null,
  expiresAt: new Date('2026-10-18T10:30:00.000Z'),
  updatedAt: new Date('2026-10-18T10:06:00.000Z'),
  key: { id: 'k1' },
  events: [{ id: 'e1', status: 'awaiting_payment', actor: 'system', note: 'Order created', at: new Date('2026-10-18T10:00:00.000Z') }],
}

describe('admin mapper', () => {
  it('maps a detail row with its flags, ISO dates and events', () => {
    const detail = toAdminDetail(detailRow)
    expect(detail).toMatchObject({
      reference: 'BMS-0000ABCD', email: 'buyer@b.test', status: 'paid', plan: 'lifetime',
      hasCookie: true, hasKey: true, locale: 'en', spotifyAccount: 'u@e.com',
      expiresAt: '2026-10-18T10:30:00.000Z', updatedAt: '2026-10-18T10:06:00.000Z',
    })
    expect(detail.events[0]).toEqual({ id: 'e1', status: 'awaiting_payment', actor: 'system', note: 'Order created', at: '2026-10-18T10:00:00.000Z' })
    expect(Object.keys(detail)).not.toContain('spDcSealed')
  })

  it('reports a missing cookie and key as flags', () => {
    const detail = toAdminDetail({ ...detailRow, spDcSealed: null, key: null })
    expect(detail.hasCookie).toBe(false)
    expect(detail.hasKey).toBe(false)
  })

  it('refuses a row whose stored enums are not recognised', () => {
    expect(() => toAdminSummary({ ...base, status: 'nope' })).toThrow(/status/)
    expect(() => toAdminSummary({ ...base, plan: 'nope' })).toThrow(/plan/)
    expect(() => toEventView({ id: 'e1', status: 'nope', actor: 'system', note: null, at: new Date() })).toThrow(/status/)
  })
})
