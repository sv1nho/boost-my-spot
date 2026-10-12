import { describe, it, expect, afterEach, afterAll } from 'vitest'
import { randomBytes } from 'node:crypto'
import { prisma } from '../../../prisma.js'
import { createOrders } from '../../../services/orders/index.js'
import { createSecretBox } from '../../../services/secret-box.js'
import { createOrderLink } from '../../../services/order-link.js'
import { isOrderReference } from '../../../../shared/reference.js'
import type { CreateOrderInput } from '../../../../shared/order.js'

const secretBox = createSecretBox(randomBytes(32))
const orderLink = createOrderLink('a-test-secret-at-least-thirty-two-characters')
const NOW = new Date('2026-10-12T12:00:00.000Z')

const invoiceCalls: unknown[] = []
const payments = {
  createInvoice: (input: unknown) => {
    invoiceCalls.push(input)
    return Promise.resolve({ id: 'inv_1', url: 'https://pay.test/i/1' })
  },
  verifyNotification: () => null,
}

const build = (stock: Record<string, number>) =>
  createOrders({
    secretBox,
    orderLink,
    upgrader: {
      stock: () => Promise.resolve({ countries: stock }),
      info: () => Promise.reject(new Error('unused')),
      upgrade: () => Promise.reject(new Error('unused')),
      renew: () => Promise.reject(new Error('unused')),
    },
    payments,
    now: () => NOW,
    config: { paymentWindowMinutes: 30, publicUrl: 'https://boost.test' },
  })

const input = (overrides: Partial<CreateOrderInput> = {}): CreateOrderInput => ({
  plan: 'lifetime',
  country: 'US',
  email: 'Buyer@Example.com',
  spDc: 'THE-COOKIE',
  locale: 'en',
  ...overrides,
})

afterEach(async () => {
  invoiceCalls.length = 0
  await prisma.upgradeKey.deleteMany()
  await prisma.order.deleteMany()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('orders service', () => {
  it('creates an order, seals the cookie and opens an invoice', async () => {
    const orders = build({ US: 5 })
    const result = await orders.create(input())

    expect(result.paymentUrl).toBe('https://pay.test/i/1')
    const id = orderLink.verify(result.token)
    expect(id).not.toBeNull()

    const order = await prisma.order.findUniqueOrThrow({ where: { id: id as string } })
    expect(order.status).toBe('awaiting_payment')
    expect(order.email).toBe('buyer@example.com')
    expect(order.priceCents).toBe(2000)
    expect(order.paymentProvider).toBe('nowpayments')
    expect(order.paymentId).toBe('inv_1')
    expect(isOrderReference(order.reference)).toBe(true)
    expect(order.expiresAt?.getTime()).toBe(NOW.getTime() + 30 * 60_000)
    expect(order.spDcSealed).not.toBeNull()
    expect(secretBox.open(order.spDcSealed as Buffer)).toBe('THE-COOKIE')

    const events = await prisma.orderEvent.findMany({ where: { orderId: order.id } })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ status: 'awaiting_payment', actor: 'system' })

    expect(invoiceCalls[0]).toMatchObject({
      reference: order.reference,
      amountCents: 2000,
      currency: 'EUR',
      successUrl: `https://boost.test/orders/${result.token}?paid=1`,
      callbackUrl: 'https://boost.test/api/payments/nowpayments',
    })
  })

  it('refuses to sell a country with no stock', async () => {
    const orders = build({ US: 0, DE: 3 })
    await expect(orders.create(input({ country: 'US' }))).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('sells ANY when at least one country has stock', async () => {
    const orders = build({ DE: 2 })
    await expect(orders.create(input({ country: 'ANY' }))).resolves.toMatchObject({ paymentUrl: 'https://pay.test/i/1' })
  })

  it('views an order by its token and never exposes the cookie', async () => {
    const orders = build({ US: 5 })
    const { token } = await orders.create(input())
    const view = await orders.view(token)
    expect(view.status).toBe('awaiting_payment')
    expect(Object.keys(view)).not.toContain('spDcSealed')
    await expect(orders.view('tampered.token')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('looks an order up by number and email, and refuses a mismatch', async () => {
    const orders = build({ US: 5 })
    const { token } = await orders.create(input())
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderLink.verify(token) as string } })

    const found = await orders.lookup({ reference: order.reference, email: 'buyer@example.com' })
    expect(orderLink.verify(found.token)).toBe(order.id)

    await expect(orders.lookup({ reference: order.reference, email: 'someone@else.com' }))
      .rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(orders.lookup({ reference: 'BMS-00000000', email: 'buyer@example.com' }))
      .rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('lists the catalog with only the countries that have stock', async () => {
    const orders = build({ US: 5, DE: 0 })
    const catalog = await orders.catalog()
    expect(catalog.countries).toEqual(['US'])
    expect(catalog.plans).toEqual([{ id: 'lifetime', label: 'Lifetime', priceCents: 2000, currency: 'EUR' }])
  })
})

const makeAwaiting = async (orders: ReturnType<typeof build>) => {
  const { token } = await orders.create(input())
  const id = orderLink.verify(token) as string
  const order = await prisma.order.findUniqueOrThrow({ where: { id } })
  return { token, id, reference: order.reference }
}

describe('orders payment webhook', () => {
  it('marks a matching payment as paid, once', async () => {
    const orders = build({ US: 5 })
    const { id, reference } = await makeAwaiting(orders)

    await orders.applyPayment({ reference, status: 'paid', priceAmountCents: 2000, currency: 'EUR' })
    const paid = await prisma.order.findUniqueOrThrow({ where: { id } })
    expect(paid.status).toBe('paid')
    expect(paid.paidAt).not.toBeNull()

    await orders.applyPayment({ reference, status: 'paid', priceAmountCents: 2000, currency: 'EUR' })
    const again = await prisma.order.findUniqueOrThrow({ where: { id } })
    expect(again.status).toBe('paid')
    expect(await prisma.orderEvent.count({ where: { orderId: id, status: 'paid' } })).toBe(1)
  })

  it('marks a wrong amount as underpaid', async () => {
    const orders = build({ US: 5 })
    const { id, reference } = await makeAwaiting(orders)
    await orders.applyPayment({ reference, status: 'paid', priceAmountCents: 1500, currency: 'EUR' })
    expect((await prisma.order.findUniqueOrThrow({ where: { id } })).status).toBe('underpaid')
  })

  it('expires the order and wipes the cookie', async () => {
    const orders = build({ US: 5 })
    const { id, reference } = await makeAwaiting(orders)
    await orders.applyPayment({ reference, status: 'expired', priceAmountCents: 2000, currency: 'EUR' })
    const expired = await prisma.order.findUniqueOrThrow({ where: { id } })
    expect(expired.status).toBe('expired')
    expect(expired.spDcSealed).toBeNull()
  })

  it('ignores a notification for an unknown order', async () => {
    const orders = build({ US: 5 })
    await expect(
      orders.applyPayment({ reference: 'BMS-00000000', status: 'paid', priceAmountCents: 2000, currency: 'EUR' })
    ).resolves.toBeUndefined()
  })
})

describe('orders cookie resubmission', () => {
  it('takes a new cookie for an order that needs action and moves it back to paid', async () => {
    const orders = build({ US: 5 })
    const { token, id } = await makeAwaiting(orders)
    await prisma.order.update({ where: { id }, data: { status: 'needs_action', spDcSealed: null } })

    const view = await orders.submitSpotify(token, 'FRESH-COOKIE')
    expect(view.status).toBe('paid')
    const order = await prisma.order.findUniqueOrThrow({ where: { id } })
    expect(secretBox.open(order.spDcSealed as Buffer)).toBe('FRESH-COOKIE')
    expect(await prisma.orderEvent.count({ where: { orderId: id, actor: 'customer' } })).toBe(1)
  })

  it('takes a cookie for a warranty renewal on an active order', async () => {
    const orders = build({ US: 5 })
    const { token, id } = await makeAwaiting(orders)
    await prisma.order.update({ where: { id }, data: { status: 'active', spDcSealed: null } })

    const view = await orders.submitSpotify(token, 'RENEW-COOKIE')
    expect(view.status).toBe('renewing')
    expect(secretBox.open((await prisma.order.findUniqueOrThrow({ where: { id } })).spDcSealed as Buffer)).toBe('RENEW-COOKIE')
  })

  it('refuses a cookie when the order is not waiting for one', async () => {
    const orders = build({ US: 5 })
    const { token } = await makeAwaiting(orders)
    await expect(orders.submitSpotify(token, 'X')).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('refuses a tampered token', async () => {
    const orders = build({ US: 5 })
    await expect(orders.submitSpotify('tampered.token', 'X')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
