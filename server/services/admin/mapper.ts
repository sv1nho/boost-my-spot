import { AppError } from '../../errors.js'
import { isOrderStatus } from '../../../shared/order-status.js'
import { isPlanId } from '../../../shared/plans.js'
import type { OrderStatus } from '../../../shared/order-status.js'
import type { PlanId } from '../../../shared/plans.js'
import type { AdminOrderDetail, AdminOrderSummary, OrderEventView } from '../../../shared/admin.js'

const iso = (date: Date | null): string | null => (date === null ? null : date.toISOString())

const checkedStatus = (status: string): OrderStatus => {
  if (!isOrderStatus(status)) {
    throw new AppError('INTERNAL_ERROR', 'Stored order status is not recognised.')
  }
  return status
}

const checkedPlan = (plan: string): PlanId => {
  if (!isPlanId(plan)) {
    throw new AppError('INTERNAL_ERROR', 'Stored plan is not recognised.')
  }
  return plan
}

type SummaryRow = {
  reference: string
  email: string
  status: string
  plan: string
  country: string
  priceCents: number
  currency: string
  attempts: number
  lastError: string | null
  createdAt: Date
  paidAt: Date | null
  activatedAt: Date | null
}

type EventRow = { id: string; status: string; actor: string; note: string | null; at: Date }

type DetailRow = SummaryRow & {
  locale: string
  spotifyAccount: string | null
  spDcSealed: Uint8Array | null
  nextAttemptAt: Date | null
  expiresAt: Date | null
  updatedAt: Date
  key: { id: string } | null
  events: EventRow[]
}

export const toAdminSummary = (row: SummaryRow): AdminOrderSummary => ({
  reference: row.reference,
  email: row.email,
  status: checkedStatus(row.status),
  plan: checkedPlan(row.plan),
  country: row.country,
  priceCents: row.priceCents,
  currency: row.currency,
  attempts: row.attempts,
  lastError: row.lastError,
  createdAt: row.createdAt.toISOString(),
  paidAt: iso(row.paidAt),
  activatedAt: iso(row.activatedAt),
})

export const toEventView = (row: EventRow): OrderEventView => ({
  id: row.id,
  status: checkedStatus(row.status),
  actor: row.actor,
  note: row.note,
  at: row.at.toISOString(),
})

export const toAdminDetail = (row: DetailRow): AdminOrderDetail => ({
  ...toAdminSummary(row),
  locale: row.locale,
  spotifyAccount: row.spotifyAccount,
  hasCookie: row.spDcSealed !== null,
  hasKey: row.key !== null,
  nextAttemptAt: iso(row.nextAttemptAt),
  expiresAt: iso(row.expiresAt),
  updatedAt: row.updatedAt.toISOString(),
  events: row.events.map(toEventView),
})
