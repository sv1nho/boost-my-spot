import { request } from './client.js'
import type { CreateOrderInput, CreatedOrder } from '../../shared/order.js'

export const createOrder = (input: CreateOrderInput): Promise<CreatedOrder> =>
  request<CreatedOrder>('/api/orders', { method: 'POST', body: input })
