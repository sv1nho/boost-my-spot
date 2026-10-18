import { createHash } from 'node:crypto'
import { prisma } from '../../prisma.js'
import { AppError } from '../../errors.js'
import { PLAN_IDS } from '../../../shared/plans.js'
import { advanceOrder } from '../orders/transition.js'
import { toAdminDetail, toAdminSummary } from './mapper.js'
import type { OrderPatch } from '../orders/transition.js'
import type { OrderStatus } from '../../../shared/order-status.js'
import type { PlanId } from '../../../shared/plans.js'
import type { AdminAction, AdminOrderDetail, AdminOrderSummary, ImportKeysResult, KeyStat } from '../../../shared/admin.js'
import type { SecretBox } from '../secret-box.js'

type Deps = {
  secretBox: SecretBox
  now: () => Date
}

export type Admin = {
  listOrders: (options: { status?: OrderStatus; limit: number }) => Promise<AdminOrderSummary[]>
  getOrder: (reference: string) => Promise<AdminOrderDetail>
  act: (reference: string, action: AdminAction) => Promise<AdminOrderDetail>
  keyStats: () => Promise<KeyStat[]>
  importKeys: (input: { plan: PlanId; raw: string }) => Promise<ImportKeysResult>
}

const SUMMARY_SELECT = {
  reference: true, email: true, status: true, plan: true, country: true,
  priceCents: true, currency: true, attempts: true, lastError: true,
  createdAt: true, paidAt: true, activatedAt: true,
} as const

const DETAIL_SELECT = {
  ...SUMMARY_SELECT,
  locale: true, spotifyAccount: true, spDcSealed: true,
  nextAttemptAt: true, expiresAt: true, updatedAt: true,
  key: { select: { id: true } },
  events: { select: { id: true, status: true, actor: true, note: true, at: true }, orderBy: { at: 'asc' } },
} as const

const URGENCY: Record<string, number> = { needs_action: 0, failed: 1, underpaid: 2 }
const rank = (status: string): number => URGENCY[status] ?? 3

const notFound = (): never => {
  throw new AppError('NOT_FOUND', 'This order could not be found.')
}

export function createAdmin ({ secretBox, now }: Deps): Admin {
  const getOrder = async (reference: string): Promise<AdminOrderDetail> => {
    const row = await prisma.order.findUnique({ where: { reference }, select: DETAIL_SELECT })
    return row === null ? notFound() : toAdminDetail(row)
  }

  const intent = (action: AdminAction): { to: OrderStatus; note: string; patch: OrderPatch } => {
    switch (action) {
      case 'retry':
        return { to: 'paid', note: 'Admin relaunched the order', patch: { attempts: 0, nextAttemptAt: null, lastError: null } }
      case 'confirm_payment':
        return { to: 'paid', note: 'Admin confirmed the payment', patch: { paidAt: now() } }
      case 'refund':
        return { to: 'refunded', note: 'Admin marked the order refunded', patch: {} }
    }
  }

  const act = async (reference: string, action: AdminAction): Promise<AdminOrderDetail> => {
    const order = await prisma.order.findUnique({ where: { reference }, select: { id: true, status: true } })
    if (order === null) return notFound()

    const { to, note, patch } = intent(action)
    if (!(await advanceOrder(order, to, 'admin', note, patch))) {
      throw new AppError('CONFLICT', 'This action is not allowed while the order is in its current state.')
    }

    return getOrder(reference)
  }

  const listOrders = async ({ status, limit }: { status?: OrderStatus; limit: number }): Promise<AdminOrderSummary[]> => {
    const rows = await prisma.order.findMany({
      where: status === undefined ? {} : { status },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: SUMMARY_SELECT,
    })
    return rows.map(toAdminSummary).sort((a, b) => rank(a.status) - rank(b.status))
  }

  const keyStats = async (): Promise<KeyStat[]> => {
    const [totals, available] = await Promise.all([
      prisma.upgradeKey.groupBy({ by: ['plan'], _count: { _all: true } }),
      prisma.upgradeKey.groupBy({ by: ['plan'], where: { orderId: null }, _count: { _all: true } }),
    ])
    const totalBy = new Map(totals.map((group) => [group.plan, group._count._all]))
    const availBy = new Map(available.map((group) => [group.plan, group._count._all]))
    return PLAN_IDS.map((plan) => {
      const total = totalBy.get(plan) ?? 0
      const avail = availBy.get(plan) ?? 0
      return { plan, total, available: avail, used: total - avail }
    })
  }

  const importKeys = async ({ plan, raw }: { plan: PlanId; raw: string }): Promise<ImportKeysResult> => {
    const unique = [...new Set(raw.split('\n').map((line) => line.trim()).filter((line) => line.length > 0))]
    if (unique.length === 0) return { imported: 0, skipped: 0 }

    const data = unique.map((key) => ({
      keyHash: createHash('sha256').update(key).digest('hex'),
      keySealed: new Uint8Array(secretBox.seal(key)),
      plan,
    }))
    const result = await prisma.upgradeKey.createMany({ data, skipDuplicates: true })
    return { imported: result.count, skipped: unique.length - result.count }
  }

  return { listOrders, getOrder, act, keyStats, importKeys }
}
