import { request } from './client.js'
import type { CreateOrderInput, CreatedOrder, OrderView } from '../../shared/order.js'

export const createOrder = (input: CreateOrderInput): Promise<CreatedOrder> =>
  request<CreatedOrder>('/api/orders', { method: 'POST', body: input })

export const getOrder = (token: string, signal?: AbortSignal): Promise<OrderView> =>
  request<OrderView>(`/api/orders/${encodeURIComponent(token)}`, { signal })

export const submitSpotify = (token: string, spDc: string): Promise<OrderView> =>
  request<OrderView>(`/api/orders/${encodeURIComponent(token)}/spotify`, { method: 'POST', body: { spDc } })

export const lookupOrder = (input: { reference: string; email: string }): Promise<{ token: string }> =>
  request<{ token: string }>('/api/orders/lookup', { method: 'POST', body: input })
