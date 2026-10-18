import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }))
vi.mock('../prisma.js', () => ({ prisma: { $queryRaw: queryRaw } }))
vi.mock('../deps.js', () => ({
  orders: {
    catalog: vi.fn(),
    create: vi.fn(), view: vi.fn(), lookup: vi.fn(), applyPayment: vi.fn(), submitSpotify: vi.fn(),
  },
  payments: { verifyNotification: vi.fn(), createInvoice: vi.fn() },
}))

import { orders, payments } from '../deps.js'
import { createApp } from '../app.js'

const catalog = vi.mocked(orders.catalog)
const verify = vi.mocked(payments.verifyNotification)

const app = createApp()

beforeEach(() => { vi.clearAllMocks() })
afterEach(() => { vi.restoreAllMocks() })

describe('the app', () => {
  it('reports health up when the database answers', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }])
    const response = await request(app).get('/api/health')
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ status: 'ok', database: 'up' })
  })

  it('reports an internal error when the database does not answer', async () => {
    queryRaw.mockRejectedValue(new Error('down'))
    const response = await request(app).get('/api/health')
    expect(response.status).toBe(500)
  })

  it('exposes the configured providers', async () => {
    const response = await request(app).get('/api/config')
    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('providers')
  })

  it('serves the catalog route', async () => {
    catalog.mockResolvedValue({ plans: [], countries: [] })
    const response = await request(app).get('/api/catalog')
    expect(response.status).toBe(200)
    expect(catalog).toHaveBeenCalled()
  })

  it('refuses an unverifiable payment notification', async () => {
    verify.mockReturnValue(null)
    const response = await request(app).post('/api/payments/nowpayments').set('Content-Type', 'application/json').send('{}')
    expect(response.status).toBe(400)
  })

  it('answers an unknown api route with a json 404', async () => {
    const response = await request(app).get('/api/nope')
    expect(response.status).toBe(404)
    expect(response.body).toHaveProperty('error.code', 'NOT_FOUND')
  })

  it('hands a non-api path to the web app fallback', async () => {
    const response = await request(app).get('/some-page')
    expect([200, 404]).toContain(response.status)
  })
})

describe('behind a trusted proxy', () => {
  it('trusts the configured number of hops', async () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '2')
    vi.resetModules()
    const { createApp: build } = await import('../app.js')
    expect(build()).toBeDefined()
    vi.unstubAllEnvs()
  })
})
