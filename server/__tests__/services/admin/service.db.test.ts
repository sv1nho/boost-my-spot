import { describe, it, expect, afterEach, afterAll } from 'vitest'
import { randomBytes } from 'node:crypto'
import { prisma } from '../../../prisma.js'
import { createAdmin } from '../../../services/admin/index.js'
import { createSecretBox } from '../../../services/secret-box.js'

const secretBox = createSecretBox(randomBytes(32))
const NOW = new Date('2026-10-18T12:00:00.000Z')
const admin = createAdmin({ secretBox, now: () => NOW })

let seq = 0
const ref = (): string => `BMS-${String(++seq).padStart(8, '0')}`
const sealed = (value: string): Uint8Array<ArrayBuffer> => new Uint8Array(secretBox.seal(value))

const makeOrder = (overrides: Record<string, unknown> = {}) =>
  prisma.order.create({
    data: { reference: ref(), email: 'buyer@boostmyspot.test', country: 'US', priceCents: 2000, ...overrides },
  })

afterEach(async () => {
  await prisma.upgradeKey.deleteMany()
  await prisma.order.deleteMany()
})

afterAll(async () => { await prisma.$disconnect() })

describe('admin orders', () => {
  it('lists the most urgent orders first', async () => {
    await makeOrder({ status: 'active' })
    await makeOrder({ status: 'underpaid' })
    await makeOrder({ status: 'needs_action' })
    await makeOrder({ status: 'failed' })
    await makeOrder({ status: 'awaiting_payment' })

    const list = await admin.listOrders({ limit: 50 })
    expect(list.slice(0, 3).map((order) => order.status)).toEqual(['needs_action', 'failed', 'underpaid'])
    expect(list).toHaveLength(5)
  })

  it('filters by a status and respects the limit', async () => {
    await makeOrder({ status: 'failed' })
    await makeOrder({ status: 'failed' })
    await makeOrder({ status: 'active' })

    expect(await admin.listOrders({ status: 'failed', limit: 50 })).toHaveLength(2)
    expect(await admin.listOrders({ limit: 1 })).toHaveLength(1)
  })

  it('returns a detail with its events, cookie and key flags', async () => {
    const order = await makeOrder({
      status: 'paid',
      spDcSealed: sealed('COOKIE'),
      events: { create: { status: 'paid', actor: 'payment', note: 'Payment received' } },
    })
    await prisma.upgradeKey.create({ data: { keyHash: 'kh1', keySealed: sealed('KEY'), orderId: order.id } })

    const detail = await admin.getOrder(order.reference)
    expect(detail.hasCookie).toBe(true)
    expect(detail.hasKey).toBe(true)
    expect(detail.events).toHaveLength(1)
    expect(detail.events[0]).toMatchObject({ status: 'paid', actor: 'payment' })
    expect(Object.keys(detail)).not.toContain('spDcSealed')
  })

  it('raises not found for an unknown order', async () => {
    await expect(admin.getOrder('BMS-00000000')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(admin.act('BMS-00000000', 'retry')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('admin actions', () => {
  it('relaunches a failed order and clears its attempts', async () => {
    const order = await makeOrder({ status: 'failed', attempts: 3, lastError: 'boom' })
    const detail = await admin.act(order.reference, 'retry')
    expect(detail.status).toBe('paid')
    expect(detail.attempts).toBe(0)
    expect(detail.lastError).toBeNull()
    const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(row.nextAttemptAt).toBeNull()
  })

  it('confirms an underpaid order', async () => {
    const order = await makeOrder({ status: 'underpaid' })
    const detail = await admin.act(order.reference, 'confirm_payment')
    expect(detail.status).toBe('paid')
    expect(detail.paidAt).not.toBeNull()
  })

  it('refunds an order that is waiting on the customer', async () => {
    const order = await makeOrder({ status: 'needs_action' })
    expect((await admin.act(order.reference, 'refund')).status).toBe('refunded')
  })

  it('refuses an action the order cannot take', async () => {
    const order = await makeOrder({ status: 'active' })
    await expect(admin.act(order.reference, 'refund')).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})

describe('admin keys', () => {
  it('reports zero for every plan when there are no keys', async () => {
    expect(await admin.keyStats()).toEqual([{ plan: 'lifetime', total: 0, available: 0, used: 0 }])
  })

  it('counts keys by availability per plan', async () => {
    const order = await makeOrder({ status: 'paid' })
    await prisma.upgradeKey.create({ data: { keyHash: 'a', keySealed: sealed('A'), orderId: null } })
    await prisma.upgradeKey.create({ data: { keyHash: 'b', keySealed: sealed('B'), orderId: null } })
    await prisma.upgradeKey.create({ data: { keyHash: 'c', keySealed: sealed('C'), orderId: order.id } })

    const stats = await admin.keyStats()
    const lifetime = stats.find((stat) => stat.plan === 'lifetime')
    expect(lifetime).toEqual({ plan: 'lifetime', total: 3, available: 2, used: 1 })
  })

  it('imports unique keys, skips duplicates and ignores blank input', async () => {
    const first = await admin.importKeys({ plan: 'lifetime', raw: 'K1\nK2\n\n  K2  \nK3' })
    expect(first).toEqual({ imported: 3, skipped: 0 })

    const second = await admin.importKeys({ plan: 'lifetime', raw: 'K2\nK4' })
    expect(second).toEqual({ imported: 1, skipped: 1 })

    expect(await admin.importKeys({ plan: 'lifetime', raw: '   \n  ' })).toEqual({ imported: 0, skipped: 0 })
    expect(await prisma.upgradeKey.count()).toBe(4)
  })
})
