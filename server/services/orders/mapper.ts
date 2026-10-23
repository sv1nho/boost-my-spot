import { AppError } from '../../errors.js'
import { isOrderStatus } from '../../../shared/order-status.js'
import { isPlanId, PLANS, PLAN_IDS, PLAN_CURRENCY } from '../../../shared/plans.js'
import type { Catalog, OrderView } from '../../../shared/order.js'

type OrderRow = {
  reference: string
  status: string
  plan: string
  country: string
  priceCents: number
  currency: string
  spotifyAccount: string | null
  lastError: string | null
  createdAt: Date
  paidAt: Date | null
  activatedAt: Date | null
}

const iso = (date: Date | null): string | null => (date === null ? null : date.toISOString())

export function toOrderView (row: OrderRow): OrderView {
  if (!isOrderStatus(row.status)) {
    throw new AppError('INTERNAL_ERROR', 'Stored order status is not recognised.')
  }
  if (!isPlanId(row.plan)) {
    throw new AppError('INTERNAL_ERROR', 'Stored plan is not recognised.')
  }

  return {
    reference: row.reference,
    status: row.status,
    plan: row.plan,
    country: row.country,
    priceCents: row.priceCents,
    currency: row.currency,
    spotifyAccount: row.spotifyAccount,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
    paidAt: iso(row.paidAt),
    activatedAt: iso(row.activatedAt),
  }
}

export function toCatalog (countries: string[]): Catalog {
  return {
    plans: PLAN_IDS.map((id) => ({
      id,
      label: PLANS[id].label,
      priceCents: PLANS[id].priceCents,
      compareAtCents: PLANS[id].compareAtCents,
      currency: PLAN_CURRENCY,
    })),
    countries,
  }
}
