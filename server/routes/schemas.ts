import { z } from 'zod'
import { PLAN_IDS } from '../../shared/plans.js'
import { ORDER_STATUSES } from '../../shared/order-status.js'
import { ADMIN_ACTIONS } from '../../shared/admin.js'
import { PROMO_KINDS } from '../../shared/promo.js'
import { isOrderReference } from '../../shared/reference.js'

const asTuple = <T extends string>(values: readonly T[]): [T, ...T[]] => values as [T, ...T[]]

export const createOrderSchema = z.object({
  plan: z.enum(asTuple(PLAN_IDS), 'Pick a plan we offer.'),
  country: z.string().regex(/^([A-Z]{2}|ANY)$/, 'Pick a country, or ANY.'),
  email: z.string().email('This is not a valid email address.').max(254),
  spDc: z.string().min(10, 'Paste your Spotify session key.').max(4096),
  locale: z.enum(['en', 'fr']).default('en'),
})

export const lookupSchema = z.object({
  reference: z.string().refine(isOrderReference, 'This is not a valid order number.'),
  email: z.string().email('This is not a valid email address.').max(254),
})

export const tokenParamSchema = z.object({ token: z.string().min(1).max(512) })

export const submitSpotifySchema = z.object({
  spDc: z.string().min(10, 'Paste your Spotify session key.').max(4096),
})

export const referenceParamSchema = z.object({
  reference: z.string().refine(isOrderReference, 'This is not a valid order number.'),
})

export const adminOrdersQuerySchema = z.object({
  status: z.enum(asTuple(ORDER_STATUSES)).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

export const adminActionSchema = z.object({
  action: z.enum(asTuple(ADMIN_ACTIONS)),
})

export const importKeysSchema = z.object({
  plan: z.enum(asTuple(PLAN_IDS)),
  keys: z.string().min(1, 'Paste at least one key.').max(100_000),
})

const promoCode = z.string().trim().min(1).max(64)

export const previewPromoSchema = z.object({
  code: promoCode,
  plan: z.enum(asTuple(PLAN_IDS)),
})

export const createPromoSchema = z
  .object({
    code: promoCode,
    kind: z.enum(asTuple(PROMO_KINDS)),
    value: z.coerce.number().int().min(1),
    expiresAt: z.string().datetime().nullish(),
    maxRedemptions: z.coerce.number().int().min(1).nullish(),
  })
  .refine((value) => value.kind !== 'percent' || value.value <= 100, {
    path: ['value'],
    message: 'A percentage must be between 1 and 100.',
  })

export const promoIdParamSchema = z.object({ id: z.string().uuid() })

export const promoActiveSchema = z.object({ active: z.boolean() })
