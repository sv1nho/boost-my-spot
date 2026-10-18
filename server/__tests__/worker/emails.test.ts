import { describe, it, expect } from 'vitest'
import { needsActionEmail, orderActiveEmail, orderFailedEmail } from '../../worker/emails.js'

const ctx = (locale: string) => ({
  email: 'buyer@example.com',
  reference: 'BMS-0000ABCD',
  trackingLink: 'https://boost.test/orders/tok',
  locale,
})

describe('order emails', () => {
  it('builds the active email in both languages', () => {
    const en = orderActiveEmail(ctx('en'))
    expect(en.to).toBe('buyer@example.com')
    expect(en.subject).toContain('BMS-0000ABCD')
    expect(en.subject).toMatch(/active/i)
    expect(en.html).toContain('https://boost.test/orders/tok')

    expect(orderActiveEmail(ctx('fr')).subject).toMatch(/actif/i)
  })

  it('builds the needs-action email in both languages', () => {
    expect(needsActionEmail(ctx('en')).subject).toMatch(/action/i)
    expect(needsActionEmail(ctx('fr')).subject).toMatch(/action/i)
    expect(needsActionEmail(ctx('fr')).text).toContain('BMS-0000ABCD')
  })

  it('builds the failed email in both languages', () => {
    expect(orderFailedEmail(ctx('en')).subject).toMatch(/problem/i)
    expect(orderFailedEmail(ctx('fr')).subject).toMatch(/souci/i)
  })
})
