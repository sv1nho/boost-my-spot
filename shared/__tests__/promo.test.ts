import { describe, it, expect } from 'vitest'
import { PROMO_KINDS, isPromoKind, normalizeCode, applyDiscount } from '../promo.js'

describe('promo kinds', () => {
  it('knows its two kinds', () => {
    expect([...PROMO_KINDS]).toEqual(['percent', 'amount'])
    expect(isPromoKind('percent')).toBe(true)
    expect(isPromoKind('amount')).toBe(true)
    expect(isPromoKind('free')).toBe(false)
    expect(isPromoKind(5)).toBe(false)
  })
})

describe('normalizeCode', () => {
  it('trims and uppercases', () => {
    expect(normalizeCode('  halloween ')).toBe('HALLOWEEN')
  })
})

describe('applyDiscount', () => {
  it('takes a percentage off', () => {
    expect(applyDiscount(2000, { kind: 'percent', value: 25 })).toEqual({ discountCents: 500, finalCents: 1500 })
  })

  it('takes a fixed amount off', () => {
    expect(applyDiscount(2000, { kind: 'amount', value: 500 })).toEqual({ discountCents: 500, finalCents: 1500 })
  })

  it('never goes below free, by percent or amount', () => {
    expect(applyDiscount(2000, { kind: 'percent', value: 100 })).toEqual({ discountCents: 2000, finalCents: 0 })
    expect(applyDiscount(2000, { kind: 'amount', value: 9999 })).toEqual({ discountCents: 2000, finalCents: 0 })
  })

  it('never applies a negative discount', () => {
    expect(applyDiscount(2000, { kind: 'amount', value: -100 })).toEqual({ discountCents: 0, finalCents: 2000 })
  })
})
