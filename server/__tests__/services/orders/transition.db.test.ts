import { describe, it, expect, afterEach, afterAll } from 'vitest'
import { prisma } from '../../../prisma.js'
import { advanceOrder } from '../../../services/orders/transition.js'

let seq = 0
const makeOrder = (status: string) =>
  prisma.order.create({
    data: { reference: `BMS-${String(++seq).padStart(8, '0')}`, email: 'a@b.test', country: 'US', priceCents: 2000, status },
  })

afterEach(async () => { await prisma.order.deleteMany() })
afterAll(async () => { await prisma.$disconnect() })

describe('advanceOrder', () => {
  it('moves the order and records an event when the status matches', async () => {
    const order = await makeOrder('paid')
    expect(await advanceOrder(order, 'upgrading', 'system', 'go')).toBe(true)
    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(after.status).toBe('upgrading')
    expect(await prisma.orderEvent.count({ where: { orderId: order.id } })).toBe(1)
  })

  it('does nothing when the row no longer holds the expected status', async () => {
    const order = await makeOrder('paid')
    expect(await advanceOrder({ id: order.id, status: 'upgrading' }, 'active', 'system', 'go')).toBe(false)
    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(after.status).toBe('paid')
    expect(await prisma.orderEvent.count({ where: { orderId: order.id } })).toBe(0)
  })
})
