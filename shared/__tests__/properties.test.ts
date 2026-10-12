import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { ORDER_STATUSES, isOrderStatus } from '../order-status.js'
import { nextStatuses, canTransition, ORDER_TRANSITIONS } from '../transitions.js'
import type { OrderStatus } from '../order-status.js'

const RUNS = { numRuns: 300, seed: 20261012 }

describe('transition graph invariants', () => {
  it('never lets a status transition to itself', () => {
    for (const status of ORDER_STATUSES) {
      expect(canTransition(status, status)).toBe(false)
    }
  })

  it('only ever targets a real status', () => {
    for (const status of ORDER_STATUSES) {
      for (const target of ORDER_TRANSITIONS[status]) {
        expect(isOrderStatus(target)).toBe(true)
      }
    }
  })

  it('reaches every status from awaiting_payment', () => {
    const seen = new Set<OrderStatus>(['awaiting_payment'])
    const queue: OrderStatus[] = ['awaiting_payment']
    while (queue.length > 0) {
      const current = queue.shift() as OrderStatus
      for (const target of ORDER_TRANSITIONS[current]) {
        if (!seen.has(target)) {
          seen.add(target)
          queue.push(target)
        }
      }
    }
    expect(seen.size).toBe(ORDER_STATUSES.length)
  })

  it('stays on valid, allowed steps for any walk', () => {
    fc.assert(
      fc.property(fc.array(fc.nat(), { maxLength: 40 }), (picks) => {
        let current: OrderStatus = 'awaiting_payment'
        for (const pick of picks) {
          const options = nextStatuses(current)
          if (options.length === 0) break
          const target = options[pick % options.length]
          expect(canTransition(current, target)).toBe(true)
          current = target
          expect(isOrderStatus(current)).toBe(true)
        }
      }),
      RUNS
    )
  })
})
