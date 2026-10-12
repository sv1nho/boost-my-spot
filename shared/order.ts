import type { OrderStatus } from './order-status.js'
import type { PlanId } from './plans.js'

export type OrderView = {
  reference: string
  status: OrderStatus
  plan: PlanId
  country: string
  priceCents: number
  currency: string
  spotifyAccount: string | null
  lastError: string | null
  createdAt: string
  paidAt: string | null
  activatedAt: string | null
}

export type CreateOrderInput = {
  plan: PlanId
  country: string
  email: string
  spDc: string
  locale: string
}

type CatalogPlan = {
  id: PlanId
  label: string
  priceCents: number
  currency: string
}

export type Catalog = {
  plans: CatalogPlan[]
  countries: string[]
}

export type CreatedOrder = { token: string; paymentUrl: string }
