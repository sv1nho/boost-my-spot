import { describe, it, expect } from 'vitest'
import { ORDER_STATUSES, isOrderStatus } from '../order-status.js'

describe('order statuses', () => {
  it('lists every status once', () => {
    expect(new Set(ORDER_STATUSES).size).toBe(ORDER_STATUSES.length)
    expect(ORDER_STATUSES).toContain('awaiting_payment')
    expect(ORDER_STATUSES).toContain('active')
    expect(ORDER_STATUSES).toContain('refunded')
  })

  it('recognises a known status and rejects anything else', () => {
    for (const status of ORDER_STATUSES) expect(isOrderStatus(status)).toBe(true)
    expect(isOrderStatus('done')).toBe(false)
    expect(isOrderStatus('')).toBe(false)
    expect(isOrderStatus(1)).toBe(false)
    expect(isOrderStatus(null)).toBe(false)
  })
})
