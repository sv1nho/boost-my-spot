import { request } from './client.js'
import type { AdminAction, AdminOrderDetail, AdminOrderSummary, ImportKeysResult, KeyStat } from '../../shared/admin.js'
import type { OrderStatus } from '../../shared/order-status.js'
import type { PlanId } from '../../shared/plans.js'

export const listAdminOrders = (
  params: { status?: OrderStatus; limit?: number },
  signal?: AbortSignal
): Promise<{ orders: AdminOrderSummary[] }> =>
  request('/api/admin/orders', { query: { status: params.status, limit: params.limit }, signal })

export const getAdminOrder = (reference: string, signal?: AbortSignal): Promise<AdminOrderDetail> =>
  request(`/api/admin/orders/${encodeURIComponent(reference)}`, { signal })

export const runAdminAction = (reference: string, action: AdminAction): Promise<AdminOrderDetail> =>
  request(`/api/admin/orders/${encodeURIComponent(reference)}/action`, { method: 'POST', body: { action } })

export const getKeyStats = (signal?: AbortSignal): Promise<{ keys: KeyStat[] }> =>
  request('/api/admin/keys', { signal })

export const importKeys = (input: { plan: PlanId; keys: string }): Promise<ImportKeysResult> =>
  request('/api/admin/keys', { method: 'POST', body: input })
