import { request } from './client.js'
import type { Catalog } from '../../shared/order.js'

export const getCatalog = (signal?: AbortSignal): Promise<Catalog> =>
  request<Catalog>('/api/catalog', { signal })
