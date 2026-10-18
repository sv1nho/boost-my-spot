import type { OrderStatus } from './order-status.js'
import type { PlanId } from './plans.js'

export type OrderEventView = {
  id: string
  status: OrderStatus
  actor: string
  note: string | null
  at: string
}

export type AdminOrderSummary = {
  reference: string
  email: string
  status: OrderStatus
  plan: PlanId
  country: string
  priceCents: number
  currency: string
  attempts: number
  lastError: string | null
  createdAt: string
  paidAt: string | null
  activatedAt: string | null
}

export type AdminOrderDetail = AdminOrderSummary & {
  locale: string
  spotifyAccount: string | null
  hasCookie: boolean
  hasKey: boolean
  nextAttemptAt: string | null
  expiresAt: string | null
  updatedAt: string
  events: OrderEventView[]
}

export const ADMIN_ACTIONS = ['retry', 'confirm_payment', 'refund'] as const

export type AdminAction = typeof ADMIN_ACTIONS[number]

export type KeyStat = {
  plan: PlanId
  total: number
  available: number
  used: number
}

export type ImportKeysResult = {
  imported: number
  skipped: number
}
