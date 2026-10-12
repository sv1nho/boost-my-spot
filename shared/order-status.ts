export const ORDER_STATUSES = [
  'awaiting_payment',
  'underpaid',
  'expired',
  'paid',
  'upgrading',
  'active',
  'renewing',
  'needs_action',
  'failed',
  'refunded',
] as const

export type OrderStatus = typeof ORDER_STATUSES[number]

export const isOrderStatus = (value: unknown): value is OrderStatus =>
  typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value)
