import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import { randomBytes } from 'node:crypto'
import { prisma } from '../../prisma.js'
import { createWorker } from '../../worker/index.js'
import { createSecretBox } from '../../services/secret-box.js'
import { createOrderLink } from '../../services/order-link.js'
import type { UpgradeResult } from '../../services/upgrader.js'

vi.mock('../../services/orders/transition.js', () => ({ advanceOrder: vi.fn().mockResolvedValue(false) }))

const secretBox = createSecretBox(randomBytes(32))
const send = vi.fn<(mail: unknown) => Promise<void>>()
const upgrade = vi.fn<() => Promise<UpgradeResult>>()
const renew = vi.fn<() => Promise<UpgradeResult>>()

const worker = createWorker({
  upgrader: {
    stock: () => Promise.resolve({ countries: {} }),
    info: () => Promise.reject(new Error('unused')),
    upgrade,
    renew,
  },
  mailer: { send: (mail) => send(mail) },
  secretBox,
  orderLink: createOrderLink('a-test-secret-at-least-thirty-two-characters'),
  now: () => new Date('2026-10-18T12:00:00.000Z'),
  publicUrl: 'https://boost.test',
  config: { batchSize: 10, maxAttempts: 5, backoffSeconds: 60 },
})

let seq = 0
const sealed = (value: string): Uint8Array<ArrayBuffer> => new Uint8Array(secretBox.seal(value))
const makeOrder = (overrides: Record<string, unknown>) =>
  prisma.order.create({
    data: { reference: `BMS-${String(++seq).padStart(8, '0')}`, email: 'b@b.test', country: 'US', priceCents: 2000, ...overrides },
  })
const makeKey = (orderId: string | null) =>
  prisma.upgradeKey.create({ data: { keyHash: `k${String(++seq).padStart(63, '0')}`, keySealed: sealed('KEY'), orderId } })

beforeEach(() => { vi.clearAllMocks(); send.mockResolvedValue(undefined) })
afterEach(async () => { await prisma.upgradeKey.deleteMany(); await prisma.order.deleteMany() })
afterAll(async () => { await prisma.$disconnect() })

describe('worker notify guards (advance did not take)', () => {
  it('sends nothing when a paid order without a cookie cannot advance', async () => {
    await makeOrder({ status: 'paid', spDcSealed: null })
    await worker.runOnce()
    expect(send).not.toHaveBeenCalled()
  })

  it('sends nothing on a cookie rejection that cannot advance', async () => {
    upgrade.mockResolvedValue({ ok: false, reason: 'cookie_rejected', message: 'x', retryAfter: null })
    await makeOrder({ status: 'paid', spDcSealed: sealed('C') })
    await makeKey(null)
    await worker.runOnce()
    expect(send).not.toHaveBeenCalled()
  })

  it('sends nothing on a hard rejection that cannot advance', async () => {
    upgrade.mockResolvedValue({ ok: false, reason: 'rejected', message: 'x', retryAfter: null })
    await makeOrder({ status: 'paid', spDcSealed: sealed('C') })
    await makeKey(null)
    await worker.runOnce()
    expect(send).not.toHaveBeenCalled()
  })

  it('sends nothing when an upgrading order cannot be completed', async () => {
    await makeOrder({ status: 'upgrading', spDcSealed: sealed('C') })
    await worker.runOnce()
    expect(send).not.toHaveBeenCalled()
  })

  it('sends nothing when a renewal without a cookie cannot advance', async () => {
    await makeOrder({ status: 'renewing', spDcSealed: null })
    await worker.runOnce()
    expect(send).not.toHaveBeenCalled()
  })

  it('sends nothing on a renewal cookie rejection that cannot advance', async () => {
    renew.mockResolvedValue({ ok: false, reason: 'cookie_rejected', message: 'x', retryAfter: null })
    const order = await makeOrder({ status: 'renewing', spDcSealed: sealed('C') })
    await makeKey(order.id)
    await worker.runOnce()
    expect(send).not.toHaveBeenCalled()
  })

  it('sends nothing when giving up on the last attempt cannot advance', async () => {
    await makeOrder({ status: 'paid', spDcSealed: sealed('C'), attempts: 4 })
    await worker.runOnce()
    expect(send).not.toHaveBeenCalled()
  })

  it('sends nothing on a renewal hard rejection that cannot advance', async () => {
    renew.mockResolvedValue({ ok: false, reason: 'rejected', message: 'x', retryAfter: null })
    const order = await makeOrder({ status: 'renewing', spDcSealed: sealed('C') })
    await makeKey(order.id)
    await worker.runOnce()
    expect(send).not.toHaveBeenCalled()
  })
})
