import { describe, it, expect, vi, afterEach, afterAll } from 'vitest'
import { randomBytes } from 'node:crypto'
import { prisma } from '../../../prisma.js'
import { createOrders } from '../../../services/orders/index.js'
import { createSecretBox } from '../../../services/secret-box.js'
import { createOrderLink } from '../../../services/order-link.js'

vi.mock('../../../services/orders/reference.js', () => ({ generateReference: vi.fn() }))
import { generateReference } from '../../../services/orders/reference.js'
const generate = vi.mocked(generateReference)

const orders = createOrders({
  secretBox: createSecretBox(randomBytes(32)),
  orderLink: createOrderLink('a-test-secret-at-least-thirty-two-characters'),
  upgrader: {
    stock: () => Promise.resolve({ countries: { US: 5 } }),
    info: () => Promise.reject(new Error('unused')),
    upgrade: () => Promise.reject(new Error('unused')),
    renew: () => Promise.reject(new Error('unused')),
  },
  payments: {
    createInvoice: (input) => Promise.resolve({ id: `inv_${input.reference}`, url: 'https://pay' }),
    verifyNotification: () => null,
  },
  now: () => new Date('2026-10-18T12:00:00.000Z'),
  config: { paymentWindowMinutes: 30, publicUrl: 'https://boost.test' },
})

const input = { plan: 'lifetime' as const, country: 'US', email: 'buyer@example.com', spDc: 'THE-COOKIE', locale: 'en' }

afterEach(async () => {
  vi.clearAllMocks()
  await prisma.order.deleteMany()
})
afterAll(async () => { await prisma.$disconnect() })

describe('reference collisions', () => {
  it('retries with a new reference when the first one is already taken', async () => {
    generate.mockReturnValueOnce('BMS-SAME0001').mockReturnValueOnce('BMS-SAME0001').mockReturnValueOnce('BMS-NEWK0002')

    await orders.create(input)
    await orders.create(input)

    const references = (await prisma.order.findMany({ select: { reference: true } })).map((o) => o.reference).sort()
    expect(references).toEqual(['BMS-NEWK0002', 'BMS-SAME0001'])
    expect(generate).toHaveBeenCalledTimes(3)
  })

  it('gives up after too many collisions', async () => {
    generate.mockReturnValue('BMS-SAME0001')
    await orders.create(input)
    await expect(orders.create(input)).rejects.toThrow()
  })

  it('rethrows an error that is not a unique collision', async () => {
    generate.mockReturnValue('BMS-GOOD0001')
    await expect(orders.create({ ...input, email: '   ' })).rejects.toThrow()
  })
})
