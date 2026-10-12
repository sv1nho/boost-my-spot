import { z } from 'zod'
import { PLAN_IDS } from '../../shared/plans.js'
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
