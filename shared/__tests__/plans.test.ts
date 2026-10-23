import { describe, it, expect } from 'vitest'
import { PLANS, PLAN_IDS, PLAN_CURRENCY, isPlanId } from '../plans.js'

describe('plans', () => {
  it('offers a single lifetime plan at 20 EUR', () => {
    expect(PLAN_IDS).toEqual(['lifetime'])
    expect(PLANS.lifetime).toEqual({ label: 'Lifetime', priceCents: 3000, compareAtCents: 6000 })
    expect(PLAN_CURRENCY).toBe('EUR')
  })

  it('recognises a known plan id and rejects anything else', () => {
    expect(isPlanId('lifetime')).toBe(true)
    expect(isPlanId('monthly')).toBe(false)
    expect(isPlanId('')).toBe(false)
    expect(isPlanId(2000)).toBe(false)
    expect(isPlanId(null)).toBe(false)
    expect(isPlanId(undefined)).toBe(false)
  })
})
