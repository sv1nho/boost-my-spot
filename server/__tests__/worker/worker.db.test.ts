import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import { randomBytes } from 'node:crypto'
import { prisma } from '../../prisma.js'
import { createWorker } from '../../worker/index.js'
import { createSecretBox } from '../../services/secret-box.js'
import { createOrderLink } from '../../services/order-link.js'
import type { UpgradeResult } from '../../services/upgrader.js'

const secretBox = createSecretBox(randomBytes(32))
const orderLink = createOrderLink('a-test-secret-at-least-thirty-two-characters')

let clock = new Date('2026-10-12T12:00:00.000Z')
const now = (): Date => clock

const send = vi.fn<(mail: { subject: string; to: string }) => Promise<void>>()
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
  orderLink,
  now,
  publicUrl: 'https://boost.test',
  config: { batchSize: 10, maxAttempts: 5, backoffSeconds: 60 },
})

let seq = 0
const ref = (): string => `BMS-${String(++seq).padStart(8, '0')}`

const sealed = (value: string): Uint8Array<ArrayBuffer> => new Uint8Array(secretBox.seal(value))

const makeOrder = (overrides: Record<string, unknown>) =>
  prisma.order.create({
    data: { reference: ref(), email: 'buyer@boostmyspot.test', country: 'US', priceCents: 2000, ...overrides },
  })

const makeKey = (orderId: string | null) =>
  prisma.upgradeKey.create({ data: { keyHash: `k${String(++seq).padStart(63, '0')}`, keySealed: sealed('KEY-VALUE'), orderId } })

const makeCorruptKey = () =>
  prisma.upgradeKey.create({ data: { keyHash: `k${String(++seq).padStart(63, '0')}`, keySealed: new Uint8Array([1, 2, 3]), orderId: null } })

beforeEach(() => {
  clock = new Date('2026-10-12T12:00:00.000Z')
  vi.clearAllMocks()
  send.mockResolvedValue(undefined)
})

afterEach(async () => {
  await prisma.upgradeKey.deleteMany()
  await prisma.order.deleteMany()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('worker', () => {
  it('expires an unpaid order whose window has passed and wipes its cookie', async () => {
    const order = await makeOrder({
      status: 'awaiting_payment',
      spDcSealed: sealed('COOKIE'),
      expiresAt: new Date('2026-10-12T11:00:00.000Z'),
    })
    await worker.runOnce()
    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(after.status).toBe('expired')
    expect(after.spDcSealed).toBeNull()
  })

  it('upgrades a paid order through to active and consumes a key', async () => {
    upgrade.mockResolvedValue({ ok: true, account: 'u@spotify.test' })
    const order = await makeOrder({ status: 'paid', spDcSealed: sealed('COOKIE') })
    await makeKey(null)

    await worker.runOnce()

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(after.status).toBe('active')
    expect(after.spotifyAccount).toBe('u@spotify.test')
    expect(after.activatedAt).not.toBeNull()
    expect(after.spDcSealed).toBeNull()

    const key = await prisma.upgradeKey.findFirstOrThrow({})
    expect(key.orderId).toBe(order.id)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].subject).toMatch(/active/i)
    expect(upgrade).toHaveBeenCalledWith({ key: 'KEY-VALUE', spDc: 'COOKIE', country: 'US' })
  })

  it('asks for a new cookie when the paid order has none', async () => {
    const order = await makeOrder({ status: 'paid', spDcSealed: null })
    await worker.runOnce()
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('needs_action')
    expect(send.mock.calls[0][0].subject).toMatch(/action/i)
  })

  it('releases the key and asks for a new cookie when upgrade rejects the cookie', async () => {
    upgrade.mockResolvedValue({ ok: false, reason: 'cookie_rejected', message: 'bad cookie', retryAfter: null })
    const order = await makeOrder({ status: 'paid', spDcSealed: sealed('COOKIE') })
    await makeKey(null)

    await worker.runOnce()

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(after.status).toBe('needs_action')
    expect(after.spDcSealed).toBeNull()
    expect(await prisma.upgradeKey.count({ where: { orderId: null } })).toBe(1)
  })

  it('backs off a paid order when no key is available', async () => {
    const order = await makeOrder({ status: 'paid', spDcSealed: sealed('COOKIE') })
    await worker.runOnce()
    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(after.status).toBe('paid')
    expect(after.attempts).toBe(1)
    expect(after.nextAttemptAt).not.toBeNull()
    expect(upgrade).not.toHaveBeenCalled()
  })

  it('reschedules a transient failure with the default backoff', async () => {
    upgrade.mockResolvedValue({ ok: false, reason: 'transient', message: 'blip', retryAfter: null })
    const order = await makeOrder({ status: 'paid', spDcSealed: sealed('COOKIE') })
    await makeKey(null)
    await worker.runOnce()
    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(after.status).toBe('paid')
    expect(after.attempts).toBe(1)
  })

  it('reschedules a rate-limited renewal by its retry-after', async () => {
    renew.mockResolvedValue({ ok: false, reason: 'rate_limited', message: 'slow', retryAfter: 90 })
    const order = await makeOrder({ status: 'renewing', spDcSealed: sealed('COOKIE') })
    await makeKey(order.id)
    await worker.runOnce()
    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(after.status).toBe('renewing')
    expect(after.attempts).toBe(1)
  })

  it('renews an active order that asked for the warranty', async () => {
    renew.mockResolvedValue({ ok: true, account: 'u@spotify.test' })
    const order = await makeOrder({ status: 'renewing', spDcSealed: sealed('COOKIE') })
    await makeKey(order.id)

    await worker.runOnce()

    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('active')
    expect(renew).toHaveBeenCalledWith({ key: 'KEY-VALUE', spDc: 'COOKIE', country: 'US' })
  })

  it('fails a paid order the upstream rejects outright', async () => {
    upgrade.mockResolvedValue({ ok: false, reason: 'rejected', message: 'account banned', retryAfter: null })
    const order = await makeOrder({ status: 'paid', spDcSealed: sealed('COOKIE') })
    await makeKey(null)
    await worker.runOnce()
    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(after.status).toBe('failed')
    expect(after.lastError).toBe('account banned')
    expect(await prisma.upgradeKey.count({ where: { orderId: null } })).toBe(1)
  })

  it('reschedules a renewal whose key has gone missing', async () => {
    const order = await makeOrder({ status: 'renewing', spDcSealed: sealed('COOKIE') })
    await worker.runOnce()
    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(after.status).toBe('renewing')
    expect(after.attempts).toBe(1)
  })

  it('keeps working when an email cannot be sent', async () => {
    send.mockRejectedValue(new Error('smtp down'))
    upgrade.mockResolvedValue({ ok: true, account: 'u@spotify.test' })
    const order = await makeOrder({ status: 'paid', spDcSealed: sealed('COOKIE') })
    await makeKey(null)
    await worker.runOnce()
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('active')
  })

  it('retries the key claim when another worker grabs it first', async () => {
    upgrade.mockResolvedValue({ ok: true, account: 'u@spotify.test' })
    const order = await makeOrder({ status: 'paid', spDcSealed: sealed('COOKIE') })
    await makeKey(null)
    const spy = vi.spyOn(prisma.upgradeKey, 'updateMany')
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValue({ count: 1 })
    await worker.runOnce()
    spy.mockRestore()
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('active')
  })

  it('backs a paid order off by the upstream retry-after', async () => {
    upgrade.mockResolvedValue({ ok: false, reason: 'rate_limited', message: 'slow down', retryAfter: 120 })
    const order = await makeOrder({ status: 'paid', spDcSealed: sealed('COOKIE') })
    await makeKey(null)
    await worker.runOnce()
    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(after.status).toBe('paid')
    expect(after.attempts).toBe(1)
    expect(await prisma.upgradeKey.count({ where: { orderId: null } })).toBe(1)
  })

  it('asks for a new cookie when a renewal needs one', async () => {
    const order = await makeOrder({ status: 'renewing', spDcSealed: null })
    await worker.runOnce()
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('needs_action')
  })

  it('sends a renewal back to needs_action when its cookie is rejected', async () => {
    renew.mockResolvedValue({ ok: false, reason: 'cookie_rejected', message: 'bad', retryAfter: null })
    const order = await makeOrder({ status: 'renewing', spDcSealed: sealed('COOKIE') })
    await makeKey(order.id)
    await worker.runOnce()
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('needs_action')
  })

  it('fails a renewal the upstream rejects', async () => {
    renew.mockResolvedValue({ ok: false, reason: 'rejected', message: 'gone', retryAfter: null })
    const order = await makeOrder({ status: 'renewing', spDcSealed: sealed('COOKIE') })
    await makeKey(order.id)
    await worker.runOnce()
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('failed')
  })

  it('retries a renewal that hits a transient error', async () => {
    renew.mockResolvedValue({ ok: false, reason: 'transient', message: 'oops', retryAfter: null })
    const order = await makeOrder({ status: 'renewing', spDcSealed: sealed('COOKIE') })
    await makeKey(order.id)
    await worker.runOnce()
    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(after.status).toBe('renewing')
    expect(after.attempts).toBe(1)
  })

  it('skips an undecryptable key and upgrades with a sound one', async () => {
    upgrade.mockResolvedValue({ ok: true, account: 'u@spotify.test' })
    const order = await makeOrder({ status: 'paid', spDcSealed: sealed('COOKIE') })
    const corrupt = await makeCorruptKey()
    await makeKey(null)

    await worker.runOnce()

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(after.status).toBe('active')
    expect(upgrade).toHaveBeenCalledWith({ key: 'KEY-VALUE', spDc: 'COOKIE', country: 'US' })
    expect((await prisma.upgradeKey.findUniqueOrThrow({ where: { id: corrupt.id } })).orderId).toBeNull()
  })

  it('backs a paid order off when every key is undecryptable, claiming none', async () => {
    const order = await makeOrder({ status: 'paid', spDcSealed: sealed('COOKIE') })
    await makeCorruptKey()
    await makeCorruptKey()

    await worker.runOnce()

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(after.status).toBe('paid')
    expect(after.attempts).toBe(1)
    expect(upgrade).not.toHaveBeenCalled()
    expect(await prisma.upgradeKey.count({ where: { orderId: null } })).toBe(2)
  })

  it('gives up after the last attempt and marks the order failed', async () => {
    upgrade.mockResolvedValue({ ok: false, reason: 'transient', message: 'upstream down', retryAfter: null })
    const order = await makeOrder({ status: 'paid', spDcSealed: sealed('COOKIE'), attempts: 4 })
    await makeKey(null)

    await worker.runOnce()

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(after.status).toBe('failed')
    expect(after.lastError).toBe('upstream down')
    expect(await prisma.upgradeKey.count({ where: { orderId: null } })).toBe(1)
    expect(send.mock.calls[0][0].subject).toMatch(/problem|souci/i)
  })
})
