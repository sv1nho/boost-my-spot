import { request } from './client.js'
import type { AdminAction, AdminOrderDetail, AdminOrderSummary, CreatePromoInput, ImportKeysResult, KeyStat, PromoSummary } from '../../shared/admin.js'
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

export const listPromos = (signal?: AbortSignal): Promise<{ promos: PromoSummary[] }> =>
  request('/api/admin/promos', { signal })

export const createPromo = (input: CreatePromoInput): Promise<PromoSummary> =>
  request('/api/admin/promos', { method: 'POST', body: input })

export const setPromoActive = (id: string, active: boolean): Promise<PromoSummary> =>
  request(`/api/admin/promos/${encodeURIComponent(id)}/active`, { method: 'POST', body: { active } })
