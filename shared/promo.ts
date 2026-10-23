export const PROMO_KINDS = ['percent', 'amount'] as const

export type PromoKind = typeof PROMO_KINDS[number]

export const isPromoKind = (value: unknown): value is PromoKind =>
  typeof value === 'string' && (PROMO_KINDS as readonly string[]).includes(value)

export const normalizeCode = (code: string): string => code.trim().toUpperCase()

export type Discount = { kind: PromoKind; value: number }

export type PromoPreview = { code: string; discountCents: number; finalCents: number }

export const applyDiscount = (
  priceCents: number,
  discount: Discount
): { discountCents: number; finalCents: number } => {
  const raw = discount.kind === 'percent'
    ? Math.round((priceCents * discount.value) / 100)
    : discount.value
  const discountCents = Math.min(Math.max(raw, 0), priceCents)
  return { discountCents, finalCents: priceCents - discountCents }
}
