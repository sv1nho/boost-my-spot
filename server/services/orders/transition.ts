import { prisma } from '../../prisma.js'
import { canTransition } from '../../../shared/transitions.js'
import { isOrderStatus } from '../../../shared/order-status.js'
import type { OrderStatus } from '../../../shared/order-status.js'

const COOKIE_STATUSES = new Set<OrderStatus>(['awaiting_payment', 'paid', 'upgrading', 'renewing'])

export type OrderPatch = {
  paidAt?: Date
  activatedAt?: Date
  spDcSealed?: Uint8Array<ArrayBuffer> | null
  spotifyAccount?: string | null
  lastError?: string | null
  nextAttemptAt?: Date | null
  attempts?: number
}

export const advanceOrder = async (
  order: { id: string; status: string },
  to: OrderStatus,
  actor: string,
  note: string,
  patch: OrderPatch = {}
): Promise<boolean> => {
  if (!isOrderStatus(order.status) || !canTransition(order.status, to)) return false

  const data = { status: to, ...patch, ...(COOKIE_STATUSES.has(to) ? {} : { spDcSealed: null }) }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({ where: { id: order.id, status: order.status }, data })
    if (updated.count === 0) return false
    await tx.orderEvent.create({ data: { orderId: order.id, status: to, actor, note } })
    return true
  })
}
