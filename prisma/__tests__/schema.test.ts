import { describe, it, expect, afterEach, afterAll } from 'vitest'
import { prisma } from '../../server/prisma.js'

let seq = 0
const ref = (): string => `BMS-${String(++seq).padStart(8, '0')}`
const hash = (): string => `h${String(++seq).padStart(63, '0')}`

const orderColumns = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  reference: ref(),
  email: 'buyer@boostmyspot.test',
  country: 'US',
  price_cents: 2000,
  ...overrides,
})

const insertOrder = (overrides: Record<string, unknown> = {}): Promise<number> => {
  const values = orderColumns(overrides)
  const columns = Object.keys(values)
  const placeholders = columns.map((_, index) => `$${String(index + 1)}`)

  return prisma.$executeRawUnsafe(
    `INSERT INTO orders (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders.join(', ')})`,
    ...Object.values(values)
  )
}

const makeOrder = (overrides: Record<string, unknown> = {}) =>
  prisma.order.create({
    data: { reference: ref(), email: 'buyer@boostmyspot.test', country: 'US', priceCents: 2000, ...overrides },
  })

afterEach(async () => {
  await prisma.upgradeKey.deleteMany()
  await prisma.order.deleteMany()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('orders constraints', () => {
  it('accepts a well-formed order', async () => {
    await expect(insertOrder()).resolves.toBe(1)
  })

  it('rejects an unknown status', async () => {
    await expect(insertOrder({ status: 'done' })).rejects.toThrow()
  })

  it('rejects a negative price', async () => {
    await expect(insertOrder({ price_cents: -1 })).rejects.toThrow()
  })

  it('rejects a malformed reference', async () => {
    await expect(insertOrder({ reference: 'BAD' })).rejects.toThrow()
    await expect(insertOrder({ reference: 'BMS-ILOU0000' })).rejects.toThrow()
  })

  it('rejects a blank email', async () => {
    await expect(insertOrder({ email: '   ' })).rejects.toThrow()
  })

  it('refuses a sealed cookie once the order is past the active statuses', async () => {
    await expect(insertOrder({ status: 'paid', sp_dc_sealed: Buffer.from('cookie') })).resolves.toBe(1)
    await expect(insertOrder({ status: 'active', sp_dc_sealed: Buffer.from('cookie') })).rejects.toThrow()
    await expect(insertOrder({ status: 'needs_action', sp_dc_sealed: Buffer.from('cookie') })).rejects.toThrow()
  })

  it('refuses to carry the cookie into active, even on update', async () => {
    const order = await makeOrder({ status: 'paid', spDcSealed: Buffer.from('cookie') })
    await expect(
      prisma.order.update({ where: { id: order.id }, data: { status: 'active' } })
    ).rejects.toThrow()
    await expect(
      prisma.order.update({ where: { id: order.id }, data: { status: 'active', spDcSealed: null } })
    ).resolves.toMatchObject({ status: 'active' })
  })

  it('bumps updated_at through the trigger, even on a raw update', async () => {
    const order = await makeOrder()
    const before = order.updatedAt.getTime()
    await new Promise((resolve) => setTimeout(resolve, 10))
    await prisma.$executeRawUnsafe(`UPDATE orders SET "last_error" = 'x' WHERE id = $1::uuid`, order.id)
    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(after.updatedAt.getTime()).toBeGreaterThan(before)
  })
})

describe('order events constraints', () => {
  it('rejects an unknown actor or status', async () => {
    const order = await makeOrder()
    await expect(
      prisma.orderEvent.create({ data: { orderId: order.id, status: 'paid', actor: 'hacker' } })
    ).rejects.toThrow()
    await expect(
      prisma.orderEvent.create({ data: { orderId: order.id, status: 'nope', actor: 'system' } })
    ).rejects.toThrow()
    await expect(
      prisma.orderEvent.create({ data: { orderId: order.id, status: 'paid', actor: 'system' } })
    ).resolves.toMatchObject({ actor: 'system' })
  })

  it('takes its events with it when the order is deleted', async () => {
    const order = await makeOrder()
    await prisma.orderEvent.create({ data: { orderId: order.id, status: 'paid', actor: 'system' } })
    await prisma.order.delete({ where: { id: order.id } })
    expect(await prisma.orderEvent.count({ where: { orderId: order.id } })).toBe(0)
  })
})

describe('upgrade keys constraints', () => {
  it('keeps each key hash and each assigned order unique', async () => {
    const shared = hash()
    await prisma.upgradeKey.create({ data: { keyHash: shared, keySealed: Buffer.from('k1') } })
    await expect(
      prisma.upgradeKey.create({ data: { keyHash: shared, keySealed: Buffer.from('k2') } })
    ).rejects.toThrow()

    const order = await makeOrder()
    await prisma.upgradeKey.create({ data: { keyHash: hash(), keySealed: Buffer.from('k3'), orderId: order.id } })
    await expect(
      prisma.upgradeKey.create({ data: { keyHash: hash(), keySealed: Buffer.from('k4'), orderId: order.id } })
    ).rejects.toThrow()
  })

  it('frees the key when its order is deleted', async () => {
    const order = await makeOrder()
    const key = await prisma.upgradeKey.create({
      data: { keyHash: hash(), keySealed: Buffer.from('k5'), orderId: order.id },
    })
    await prisma.order.delete({ where: { id: order.id } })
    const after = await prisma.upgradeKey.findUniqueOrThrow({ where: { id: key.id } })
    expect(after.orderId).toBeNull()
  })
})
