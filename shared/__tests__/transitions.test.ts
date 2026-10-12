import { describe, it, expect } from 'vitest'
import { ORDER_STATUSES } from '../order-status.js'
import {
  ORDER_TRANSITIONS,
  nextStatuses,
  canTransition,
  isTerminal,
  TERMINAL_STATUSES,
} from '../transitions.js'

describe('order transitions', () => {
  it('describes every status exactly once', () => {
    expect(Object.keys(ORDER_TRANSITIONS).sort()).toEqual([...ORDER_STATUSES].sort())
  })

  it('allows the steps the worker and payments drive', () => {
    expect(canTransition('awaiting_payment', 'paid')).toBe(true)
    expect(canTransition('paid', 'upgrading')).toBe(true)
    expect(canTransition('upgrading', 'active')).toBe(true)
    expect(canTransition('active', 'renewing')).toBe(true)
    expect(canTransition('needs_action', 'paid')).toBe(true)
  })

  it('forbids skipping or inventing steps', () => {
    expect(canTransition('awaiting_payment', 'active')).toBe(false)
    expect(canTransition('paid', 'active')).toBe(false)
    expect(canTransition('refunded', 'paid')).toBe(false)
  })

  it('reports refunded as the only terminal status', () => {
    expect(nextStatuses('refunded')).toEqual([])
    expect(isTerminal('refunded')).toBe(true)
    expect(isTerminal('active')).toBe(false)
    expect(TERMINAL_STATUSES).toEqual(['refunded'])
  })
})
