import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import type { PaymentNotification, PaymentProvider } from './provider.js'

type Deps = {
  fetch: typeof fetch
  baseUrl: string
  apiKey: string
  ipnSecret: string
  timeoutMs?: number
}

const DEFAULT_TIMEOUT = 15_000

const invoiceSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  invoice_url: z.string(),
})

const ipnSchema = z.object({
  order_id: z.string(),
  payment_status: z.string(),
  price_amount: z.coerce.number(),
  price_currency: z.string(),
})

const STATUS: Record<string, PaymentNotification['status']> = {
  finished: 'paid',
  partially_paid: 'underpaid',
  expired: 'expired',
  failed: 'expired',
  refunded: 'expired',
}

const sortDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortDeep)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, sortDeep((value as Record<string, unknown>)[key])])
    )
  }
  return value
}

export function createNowPayments ({ fetch, baseUrl, apiKey, ipnSecret, timeoutMs = DEFAULT_TIMEOUT }: Deps): PaymentProvider {
  return {
    createInvoice: async ({ reference, amountCents, currency, successUrl, callbackUrl }) => {
      const response = await fetch(`${baseUrl}/invoice`, {
        method: 'POST',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price_amount: amountCents / 100,
          price_currency: currency.toLowerCase(),
          order_id: reference,
          success_url: successUrl,
          ipn_callback_url: callbackUrl,
        }),
      })

      if (!response.ok) {
        throw new Error(`NOWPayments refused the invoice: ${String(response.status)}`)
      }

      const invoice = invoiceSchema.parse(await response.json())
      return { id: invoice.id, url: invoice.invoice_url }
    },

    verifyNotification: (rawBody, signature) => {
      let body: unknown
      try {
        body = JSON.parse(rawBody)
      } catch {
        return null
      }

      const expected = createHmac('sha512', ipnSecret)
        .update(JSON.stringify(sortDeep(body)))
        .digest('hex')

      const given = Buffer.from(signature)
      const want = Buffer.from(expected)
      if (given.length !== want.length || !timingSafeEqual(given, want)) return null

      const parsed = ipnSchema.safeParse(body)
      if (!parsed.success) return null

      const status = STATUS[parsed.data.payment_status]
      if (status === undefined) return null

      return {
        reference: parsed.data.order_id,
        status,
        priceAmountCents: Math.round(parsed.data.price_amount * 100),
        currency: parsed.data.price_currency.toUpperCase(),
      }
    },
  }
}
