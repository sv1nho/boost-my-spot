import { describe, it, expect, vi, afterEach, afterAll } from 'vitest'
import { prisma } from '../../../prisma.js'
import { createPromos } from '../../../services/promo/index.js'

const NOW = new Date('2026-10-23T12:00:00.000Z')
const promos = createPromos({ now: () => NOW })

afterEach(async () => { await prisma.promoCode.deleteMany() })
afterAll(async () => { await prisma.$disconnect() })

describe('promo codes', () => {
  it('creates, lists and previews a percentage code', async () => {
    const created = await promos.create({ code: '  save25 ', kind: 'percent', value: 25 })
    expect(created.code).toBe('SAVE25')

    expect(await promos.list()).toHaveLength(1)
    expect(await promos.preview('save25', 2000)).toEqual({ code: 'SAVE25', discountCents: 500, finalCents: 1500 })
  })

  it('stores an expiry and a usage cap when given', async () => {
    const created = await promos.create({ code: 'EVENT', kind: 'percent', value: 50, expiresAt: '2026-12-31T00:00:00.000Z', maxRedemptions: 10 })
    expect(created.expiresAt).toBe('2026-12-31T00:00:00.000Z')
    expect(created.maxRedemptions).toBe(10)
  })

  it('previews a code that has a future expiry and remaining uses', async () => {
    await prisma.promoCode.create({
      data: { code: 'HALLOWEEN', kind: 'percent', value: 50, expiresAt: new Date('2026-12-31T00:00:00.000Z'), maxRedemptions: 10, redemptions: 3 },
    })
    expect(await promos.preview('HALLOWEEN', 2000)).toEqual({ code: 'HALLOWEEN', discountCents: 1000, finalCents: 1000 })
  })

  it('refuses a duplicate code', async () => {
    await promos.create({ code: 'DUP', kind: 'amount', value: 500 })
    await expect(promos.create({ code: 'dup', kind: 'amount', value: 300 })).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('rethrows a non-duplicate database error', async () => {
    await expect(promos.create({ code: 'BAD', kind: 'percent', value: 150 })).rejects.toThrow()
  })

  it('rejects an unknown, inactive, expired or used-up code', async () => {
    await expect(promos.preview('ghost', 2000)).rejects.toMatchObject({ code: 'BAD_REQUEST' })

    await prisma.promoCode.create({ data: { code: 'OFF', kind: 'amount', value: 500, active: false } })
    await expect(promos.preview('OFF', 2000)).rejects.toMatchObject({ code: 'BAD_REQUEST' })

    await prisma.promoCode.create({ data: { code: 'OLD', kind: 'amount', value: 500, expiresAt: new Date('2026-10-22T12:00:00.000Z') } })
    await expect(promos.preview('OLD', 2000)).rejects.toMatchObject({ code: 'BAD_REQUEST' })

    await prisma.promoCode.create({ data: { code: 'USED', kind: 'amount', value: 500, maxRedemptions: 1, redemptions: 1 } })
    await expect(promos.preview('USED', 2000)).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('redeems a capped code up to its limit', async () => {
    await promos.create({ code: 'LIM', kind: 'amount', value: 500, maxRedemptions: 1 })
    expect(await promos.redeem('lim', 2000)).toEqual({ code: 'LIM', discountCents: 500, finalCents: 1500 })
    expect((await prisma.promoCode.findFirstOrThrow({ where: { code: 'LIM' } })).redemptions).toBe(1)
    await expect(promos.redeem('lim', 2000)).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('redeems an unlimited code repeatedly', async () => {
    await promos.create({ code: 'UNL', kind: 'percent', value: 10 })
    await promos.redeem('UNL', 2000)
    expect((await promos.redeem('UNL', 2000)).finalCents).toBe(1800)
    expect((await prisma.promoCode.findFirstOrThrow({ where: { code: 'UNL' } })).redemptions).toBe(2)
  })

  it('rejects a redemption claimed concurrently', async () => {
    await promos.create({ code: 'RACE', kind: 'amount', value: 500 })
    const spy = vi.spyOn(prisma.promoCode, 'updateMany').mockResolvedValueOnce({ count: 0 })
    await expect(promos.redeem('RACE', 2000)).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    spy.mockRestore()
  })

  it('toggles active and reports a missing code', async () => {
    const created = await promos.create({ code: 'TOG', kind: 'amount', value: 500 })
    expect((await promos.setActive(created.id, false)).active).toBe(false)
    await expect(promos.setActive('11111111-1111-4111-8111-111111111111', true)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
