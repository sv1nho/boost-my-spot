import { describe, it, expect } from 'vitest'
import { isOrderReference } from '../reference.js'

describe('order reference', () => {
  it('accepts a well-formed reference and rejects the rest', () => {
    expect(isOrderReference('BMS-0123ABCD')).toBe(true)
    expect(isOrderReference('BMS-ILOU1234')).toBe(false)
    expect(isOrderReference('XXX-0123ABCD')).toBe(false)
    expect(isOrderReference('BMS-0123')).toBe(false)
    expect(isOrderReference('BMS-0123abcd')).toBe(false)
    expect(isOrderReference('')).toBe(false)
    expect(isOrderReference(42)).toBe(false)
  })
})
