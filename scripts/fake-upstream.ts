import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createHmac } from 'node:crypto'
import { loadLocalEnv } from '../server/load-env.js'

loadLocalEnv()

const PORT = Number(process.env.FAKE_UPSTREAM_PORT ?? 3199)
const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET ?? 'dev-nowpayments-ipn-secret'
const SELF = `http://127.0.0.1:${String(PORT)}`

const STOCK: Record<string, number> = { US: 100, GB: 80, NL: 50, DE: 0 }

type Invoice = { callback: string; success: string; amount: number; currency: string }
const invoices = new Map<string, Invoice>()

type SentEmail = { to: string; subject: string; html: string }
const sentEmails: SentEmail[] = []

const sortDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortDeep)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>).sort().map((k) => [k, sortDeep((value as Record<string, unknown>)[k])])
    )
  }
  return value
}

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk as string })
    req.on('end', () => { resolve(data) })
  })

const json = (res: ServerResponse, status: number, body: unknown): void => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

const sendIpn = async (invoice: Invoice, orderId: string): Promise<void> => {
  const body = {
    order_id: orderId,
    payment_status: 'finished',
    price_amount: invoice.amount,
    price_currency: invoice.currency,
  }
  const signature = createHmac('sha512', IPN_SECRET).update(JSON.stringify(sortDeep(body))).digest('hex')
  await fetch(invoice.callback, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-nowpayments-sig': signature },
    body: JSON.stringify(body),
  })
}

const server = createServer((req, res) => {
  void (async () => {
    const url = new URL(req.url ?? '/', SELF)
    const path = url.pathname
    const method = req.method ?? 'GET'

    if (method === 'GET' && path === '/upgrader/stock') {
      json(res, 200, { status: 'success', stock: STOCK })
      return
    }

    if (method === 'POST' && path === '/upgrader/info') {
      json(res, 200, { status: 'success', key: { status: 'unused', username: null, country: null } })
      return
    }

    if (method === 'POST' && (path === '/upgrader/upgrade' || path === '/upgrader/renew')) {
      const payload = JSON.parse(await readBody(req)) as { sp_dc?: string }
      if (payload.sp_dc?.includes('invalid') === true) {
        json(res, 400, { status: 'error', code: 'cookie_rejected', message: 'The session cookie was rejected.' })
        return
      }
      json(res, 200, { status: 'success', account: 'dev-user@spotify.test' })
      return
    }

    if (method === 'POST' && path === '/nowpayments/invoice') {
      const payload = JSON.parse(await readBody(req)) as {
        order_id: string; price_amount: number; price_currency: string; ipn_callback_url: string; success_url: string
      }
      invoices.set(payload.order_id, {
        callback: payload.ipn_callback_url,
        success: payload.success_url,
        amount: payload.price_amount,
        currency: payload.price_currency,
      })
      json(res, 200, { id: `fake_inv_${payload.order_id}`, invoice_url: `${SELF}/nowpayments/pay?order=${payload.order_id}` })
      return
    }

    if (method === 'GET' && path === '/nowpayments/pay') {
      const orderId = url.searchParams.get('order') ?? ''
      const invoice = invoices.get(orderId)
      if (invoice === undefined) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Unknown invoice')
        return
      }
      await sendIpn(invoice, orderId)
      if (invoice.success !== '') {
        res.writeHead(302, { Location: invoice.success })
        res.end()
        return
      }
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<p>Payment simulated. Return to the tracking page.</p>')
      return
    }

    if (method === 'POST' && path === '/resend/emails') {
      const payload = JSON.parse(await readBody(req)) as { to?: string; subject?: string; html?: string }
      sentEmails.push({ to: payload.to ?? '', subject: payload.subject ?? '', html: payload.html ?? '' })
      console.log(`[fake-upstream] email to ${payload.to ?? '?'}: ${payload.subject ?? ''}`)
      json(res, 200, { id: 'fake_email' })
      return
    }

    if (method === 'GET' && path === '/resend/sent') {
      const to = url.searchParams.get('to')
      json(res, 200, { emails: to === null ? sentEmails : sentEmails.filter((email) => email.to === to) })
      return
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
  })()
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[fake-upstream] upgrader + nowpayments + resend on ${SELF}`)
})
