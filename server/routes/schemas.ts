import { z } from 'zod'
import { PLAN_IDS } from '../../shared/plans.js'
import { ORDER_STATUSES } from '../../shared/order-status.js'
import { ADMIN_ACTIONS } from '../../shared/admin.js'
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
