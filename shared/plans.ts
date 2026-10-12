export const PLAN_CURRENCY = 'EUR'

export const PLANS = {
  lifetime: { label: 'Lifetime', priceCents: 2000 },
} as const satisfies Record<string, { label: string; priceCents: number }>

export type PlanId = keyof typeof PLANS

export const PLAN_IDS = Object.keys(PLANS) as PlanId[]

export const isPlanId = (value: unknown): value is PlanId =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(PLANS, value)
