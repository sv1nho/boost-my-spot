import type { OrderStatus } from '../../shared/order-status.js'

const LABELS: Record<OrderStatus, string> = {
  awaiting_payment: 'Waiting for payment',
  underpaid: 'Payment incomplete',
  expired: 'Payment expired',
  paid: 'Payment received',
  upgrading: 'Upgrading',
  active: 'Premium active',
  renewing: 'Renewing',
  needs_action: 'Action needed',
  failed: 'Could not be completed',
  refunded: 'Refunded',
}

export const statusLabel = (status: OrderStatus): string => LABELS[status]

const MILESTONE_LABELS = ['Payment received', 'Upgrading', 'Premium active'] as const

const reached = (status: OrderStatus): number => {
  if (status === 'active') return 3
  if (['paid', 'upgrading', 'renewing', 'needs_action', 'failed'].includes(status)) return 2
  return 1
}

export type Milestone = { label: string; done: boolean; current: boolean }

export const milestones = (status: OrderStatus): Milestone[] => {
  const level = reached(status)
  const done = [level >= 2, level >= 3, level >= 3]
  const current = done.indexOf(false)
  return MILESTONE_LABELS.map((label, index) => ({ label, done: done[index], current: index === current }))
}
