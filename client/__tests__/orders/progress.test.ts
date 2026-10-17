import { describe, it, expect } from 'vitest'
import { statusLabel, milestones } from '../../orders/progress.js'

describe('order progress', () => {
  it('labels every status', () => {
    expect(statusLabel('awaiting_payment')).toBe('Waiting for payment')
    expect(statusLabel('active')).toBe('Premium active')
    expect(statusLabel('needs_action')).toBe('Action needed')
  })

  it('places the order on the three-step timeline', () => {
    const waiting = milestones('awaiting_payment')
    expect(waiting.map((m) => m.done)).toEqual([false, false, false])
    expect(waiting[0].current).toBe(true)

    const paid = milestones('paid')
    expect(paid.map((m) => m.done)).toEqual([true, false, false])
    expect(paid[1].current).toBe(true)

    const active = milestones('active')
    expect(active.map((m) => m.done)).toEqual([true, true, true])
    expect(active.some((m) => m.current)).toBe(false)
  })
})
