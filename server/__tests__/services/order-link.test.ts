import { describe, it, expect } from 'vitest'
import { createOrderLink } from '../../services/order-link.js'

const id = '00000000-0000-4000-8000-000000000001'

describe('order link', () => {
  it('signs a token that verifies back to the order id', () => {
    const link = createOrderLink('a-secret-at-least-thirty-two-characters')
    const token = link.sign(id)
    expect(token.startsWith(`${id}.`)).toBe(true)
    expect(link.verify(token)).toBe(id)
  })

  it('rejects a token signed with another secret', () => {
    const token = createOrderLink('secret-one-at-least-thirty-two-characters').sign(id)
    expect(createOrderLink('secret-two-at-least-thirty-two-characters').verify(token)).toBeNull()
  })

  it('rejects a tampered signature of the same length', () => {
    const link = createOrderLink('a-secret-at-least-thirty-two-characters')
    const token = link.sign(id)
    const flipped = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`
    expect(link.verify(flipped)).toBeNull()
  })

  it('rejects a malformed token', () => {
    const link = createOrderLink('a-secret-at-least-thirty-two-characters')
    expect(link.verify('no-dot-here')).toBeNull()
    expect(link.verify('.leadingdot')).toBeNull()
    expect(link.verify('trailingdot.')).toBeNull()
    expect(link.verify(`${id}.short`)).toBeNull()
  })
})
