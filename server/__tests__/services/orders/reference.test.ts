import { describe, it, expect } from 'vitest'
import { generateReference } from '../../../services/orders/reference.js'
import { isOrderReference } from '../../../../shared/reference.js'

describe('reference generator', () => {
  it('produces well-formed, well-varied references', () => {
    const made = Array.from({ length: 50 }, () => generateReference())
    for (const reference of made) expect(isOrderReference(reference)).toBe(true)
    expect(new Set(made).size).toBeGreaterThan(40)
  })
})
