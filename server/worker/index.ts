import { prisma } from '../prisma.js'
import { log } from '../log.js'
import { advanceOrder } from '../services/orders/transition.js'
import { needsActionEmail, orderActiveEmail, orderFailedEmail } from '../emails.js'
import type { Mail, Mailer } from '../services/mail.js'
import type { SecretBox } from '../services/secret-box.js'
import type { OrderLink } from '../services/order-link.js'
import type { Upgrader } from '../services/upgrader.js'

type WorkerConfig = {
  batchSize: number
  maxAttempts: number
  backoffSeconds: number
}

type WorkerDeps = {
  upgrader: Upgrader
  mailer: Mailer
  secretBox: SecretBox
  orderLink: OrderLink
  now: () => Date
  publicUrl: string
  config: WorkerConfig
}

export type Worker = { runOnce: () => Promise<void> }

type OrderJob = {
  id: string
  status: string
  email: string
  reference: string
  locale: string
  country: string
  plan: string
  attempts: number
  spDcSealed: Uint8Array | null
}

const JOB_FIELDS = {
  id: true, status: true, email: true, reference: true, locale: true,
  country: true, plan: true, attempts: true, spDcSealed: true,
} as const

export function createWorker ({ upgrader, mailer, secretBox, orderLink, now, publicUrl, config }: WorkerDeps): Worker {
  const linkFor = (id: string): string => `${publicUrl}/orders/${orderLink.sign(id)}`

  const notify = async (order: OrderJob, build: (c: { email: string; reference: string; trackingLink: string; locale: string }) => Mail): Promise<void> => {
    try {
      await mailer.send(build({ email: order.email, reference: order.reference, trackingLink: linkFor(order.id), locale: order.locale }))
    } catch (cause) {
      log('warn', 'could not send an email', { reference: order.reference, cause: String(cause) })
    }
  }

  const ready = (status: string): Promise<OrderJob[]> =>
    prisma.order.findMany({
      where: { status, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now() } }] },
      take: config.batchSize,
      select: JOB_FIELDS,
    })

  const releaseKey = async (orderId: string): Promise<void> => {
    await prisma.upgradeKey.updateMany({ where: { orderId }, data: { orderId: null } })
  }

  const claimKey = async (orderId: string, plan: string): Promise<string | null> => {
    const key = await prisma.upgradeKey.findFirst({ where: { orderId: null, plan }, select: { id: true, keySealed: true } })
    if (key === null) return null
    const claimed = await prisma.upgradeKey.updateMany({ where: { id: key.id, orderId: null }, data: { orderId } })
    if (claimed.count === 0) return claimKey(orderId, plan)
    return secretBox.open(Buffer.from(key.keySealed))
  }

  const reschedule = async (order: OrderJob, message: string, delaySeconds: number): Promise<void> => {
    if (order.attempts + 1 >= config.maxAttempts) {
      const moved = await advanceOrder(order, 'failed', 'system', `Giving up: ${message}`, { lastError: message })
      if (moved) await notify(order, orderFailedEmail)
      return
    }
    await prisma.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { nextAttemptAt: new Date(now().getTime() + delaySeconds * 1000), attempts: { increment: 1 }, lastError: message },
    })
  }

  const expireAwaiting = async (): Promise<void> => {
    const due = await prisma.order.findMany({
      where: { status: 'awaiting_payment', expiresAt: { lt: now() } },
      take: config.batchSize,
      select: JOB_FIELDS,
    })
    for (const order of due) await advanceOrder(order, 'expired', 'system', 'Payment window expired')
  }

  const executePaid = async (): Promise<void> => {
    for (const order of await ready('paid')) {
      if (order.spDcSealed === null) {
        if (await advanceOrder(order, 'needs_action', 'system', 'Session key missing; waiting for a new one')) {
          await notify(order, needsActionEmail)
        }
        continue
      }

      const key = await claimKey(order.id, order.plan)
      if (key === null) {
        await reschedule(order, 'No upgrade key available yet', config.backoffSeconds)
        continue
      }

      const spDc = secretBox.open(Buffer.from(order.spDcSealed))
      const result = await upgrader.upgrade({ key, spDc, country: order.country })

      if (result.ok) {
        await advanceOrder(order, 'upgrading', 'system', 'Upgrade requested', { spotifyAccount: result.account, nextAttemptAt: now() })
      } else if (result.reason === 'cookie_rejected') {
        await releaseKey(order.id)
        if (await advanceOrder(order, 'needs_action', 'system', result.message)) await notify(order, needsActionEmail)
      } else if (result.reason === 'rejected') {
        await releaseKey(order.id)
        if (await advanceOrder(order, 'failed', 'system', result.message, { lastError: result.message })) await notify(order, orderFailedEmail)
      } else {
        await releaseKey(order.id)
        await reschedule(order, result.message, result.retryAfter ?? config.backoffSeconds)
      }
    }
  }

  const completeUpgrading = async (): Promise<void> => {
    for (const order of await ready('upgrading')) {
      if (await advanceOrder(order, 'active', 'system', 'Premium is active', { activatedAt: now() })) {
        await notify(order, orderActiveEmail)
      }
    }
  }

  const processRenewing = async (): Promise<void> => {
    for (const order of await ready('renewing')) {
      if (order.spDcSealed === null) {
        if (await advanceOrder(order, 'needs_action', 'system', 'Session key missing for the renewal')) {
          await notify(order, needsActionEmail)
        }
        continue
      }

      const key = await prisma.upgradeKey.findFirst({ where: { orderId: order.id }, select: { keySealed: true } })
      if (key === null) {
        await reschedule(order, 'The upgrade key is gone', config.backoffSeconds)
        continue
      }

      const spDc = secretBox.open(Buffer.from(order.spDcSealed))
      const result = await upgrader.renew({ key: secretBox.open(Buffer.from(key.keySealed)), spDc, country: order.country })

      if (result.ok) {
        await advanceOrder(order, 'active', 'system', 'Premium renewed', { activatedAt: now() })
        await notify(order, orderActiveEmail)
      } else if (result.reason === 'cookie_rejected') {
        if (await advanceOrder(order, 'needs_action', 'system', result.message)) await notify(order, needsActionEmail)
      } else if (result.reason === 'rejected') {
        if (await advanceOrder(order, 'failed', 'system', result.message, { lastError: result.message })) await notify(order, orderFailedEmail)
      } else {
        await reschedule(order, result.message, result.retryAfter ?? config.backoffSeconds)
      }
    }
  }

  const runOnce = async (): Promise<void> => {
    await expireAwaiting()
    await executePaid()
    await completeUpgrading()
    await processRenewing()
  }

  return { runOnce }
}
