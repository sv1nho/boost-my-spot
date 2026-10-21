import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { createNowPayments } from '../../../services/payments/nowpayments.js'

const sortDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortDeep)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortDeep((value as Record<string, unknown>)[k])])
    )
  }
  return value
}

const sign = (body: Record<string, unknown>, secret: string): string =>
  createHmac('sha512', secret).update(JSON.stringify(sortDeep(body))).digest('hex')

const SECRET = 'ipn-secret'

const makeFetch = (payload: unknown, status = 200) => {
  const calls: { url: string; init: RequestInit }[] = []
  const fn = ((url: string, init: RequestInit = {}) => {
    calls.push({ url, init })
    return Promise.resolve({ status, ok: status < 400, json: () => Promise.resolve(payload) } as unknown as Response)
  }) as unknown as typeof fetch
  return { fn, calls }
}

const provider = (payload: unknown, status = 200) => {
  const { fn, calls } = makeFetch(payload, status)
  return {
    client: createNowPayments({ fetch: fn, baseUrl: 'https://np.test/v1', apiKey: 'k', ipnSecret: SECRET }),
    calls,
  }
}

describe('nowpayments adapter', () => {
  it('creates an invoice in major units with the reference as order id', async () => {
    const { client, calls } = provider({ id: 4242, invoice_url: 'https://pay.test/i/1' })
    const invoice = await client.createInvoice({
      reference: 'BMS-0000ABCD', amountCents: 2000, currency: 'EUR',
      successUrl: 'https://s', callbackUrl: 'https://c',
    })
    expect(invoice).toEqual({ id: '4242', url: 'https://pay.test/i/1' })
    expect(calls[0].url).toBe('https://np.test/v1/invoice')
    expect(JSON.parse(calls[0].init.body as string)).toMatchObject({
      price_amount: 20, price_currency: 'eur', order_id: 'BMS-0000ABCD',
    })
  })

  it('throws when the invoice is refused', async () => {
    const { client } = provider({ message: 'nope' }, 400)
    await expect(
      client.createInvoice({ reference: 'R', amountCents: 2000, currency: 'EUR', successUrl: 's', callbackUrl: 'c' })
    ).rejects.toThrow()
  })

  it('accepts a correctly signed notification and maps its status', () => {
    const { client } = provider({})
    const body = { order_id: 'BMS-0000ABCD', payment_status: 'finished', price_amount: 20, price_currency: 'eur' }
    const raw = JSON.stringify(body)
    expect(client.verifyNotification(raw, sign(body, SECRET))).toEqual({
      reference: 'BMS-0000ABCD', status: 'paid', priceAmountCents: 2000, currency: 'EUR',
    })
  })

  it('maps partial and expired payments', () => {
    const { client } = provider({})
    const partial = { order_id: 'R', payment_status: 'partially_paid', price_amount: 20, price_currency: 'eur' }
    const expired = { order_id: 'R', payment_status: 'expired', price_amount: 20, price_currency: 'eur' }
    expect(client.verifyNotification(JSON.stringify(partial), sign(partial, SECRET))?.status).toBe('underpaid')
    expect(client.verifyNotification(JSON.stringify(expired), sign(expired, SECRET))?.status).toBe('expired')
  })

  it('rejects a correctly signed but malformed notification', () => {
    const { client } = provider({})
    const body = { payment_status: 'finished' }
    expect(client.verifyNotification(JSON.stringify(body), sign(body, SECRET))).toBeNull()
  })

  it('rejects a body that is not valid json', () => {
    const { client } = provider({})
    expect(client.verifyNotification('{not json', 'deadbeef')).toBeNull()
  })

  it('handles nested arrays in the signed payload', () => {
    const { client } = provider({})
    const body = { order_id: 'R', payment_status: 'finished', price_amount: 20, price_currency: 'eur', outputs: [{ b: 2, a: 1 }] }
    expect(client.verifyNotification(JSON.stringify(body), sign(body, SECRET))?.status).toBe('paid')
  })

  it('rejects a wrong signature of the same length', () => {
    const { client } = provider({})
    const body = { order_id: 'R', payment_status: 'finished', price_amount: 20, price_currency: 'eur' }
    expect(client.verifyNotification(JSON.stringify(body), 'a'.repeat(128))).toBeNull()
  })

  it('rejects a bad signature or a non-terminal status', () => {
    const { client } = provider({})
    const body = { order_id: 'R', payment_status: 'finished', price_amount: 20, price_currency: 'eur' }
    expect(client.verifyNotification(JSON.stringify(body), 'deadbeef')).toBeNull()

    const waiting = { order_id: 'R', payment_status: 'waiting', price_amount: 20, price_currency: 'eur' }
    expect(client.verifyNotification(JSON.stringify(waiting), sign(waiting, SECRET))).toBeNull()
  })
})
