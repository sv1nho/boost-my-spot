import { ORDER_STATUSES } from './order-status.js'
import type { OrderStatus } from './order-status.js'

export const ORDER_TRANSITIONS = {
  awaiting_payment: ['paid', 'expired', 'underpaid'],
  underpaid: ['paid', 'refunded'],
  expired: ['paid'],
  paid: ['upgrading', 'needs_action', 'failed'],
  upgrading: ['active', 'needs_action', 'failed', 'paid'],
  renewing: ['active', 'needs_action', 'failed'],
  active: ['renewing'],
  needs_action: ['paid', 'refunded'],
  failed: ['paid', 'refunded'],
  refunded: [],
} as const satisfies Record<OrderStatus, readonly OrderStatus[]>

export const nextStatuses = (from: OrderStatus): readonly OrderStatus[] => ORDER_TRANSITIONS[from]

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean =>
  (ORDER_TRANSITIONS[from] as readonly OrderStatus[]).includes(to)

export const isTerminal = (status: OrderStatus): boolean => ORDER_TRANSITIONS[status].length === 0

export const TERMINAL_STATUSES = ORDER_STATUSES.filter(isTerminal)
