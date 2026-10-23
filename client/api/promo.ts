import { request } from './client.js'
import type { PromoPreview } from '../../shared/promo.js'
import type { PlanId } from '../../shared/plans.js'

export const previewPromo = (code: string, plan: PlanId): Promise<PromoPreview> =>
  request('/api/promo', { method: 'POST', body: { code, plan } })
