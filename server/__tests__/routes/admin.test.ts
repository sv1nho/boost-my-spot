import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { AppError } from '../../errors.js'
import { createErrorHandler, notFoundHandler } from '../../middleware/error-handler.js'
import { bodyOf } from './http.js'
import type { Admin } from '../../services/admin/index.js'
import type { Promos } from '../../services/promo/index.js'

vi.mock('../../auth/require-user.js', () => ({
  requireUser: (req: { user?: unknown }, _res: unknown, next: () => void) => {
    req.user = { id: 'u', email: 'admin@b.test', name: 'Admin', image: null }
    next()
  },
  currentUser: () => ({ id: 'u', email: 'admin@b.test', name: 'Admin', image: null }),
}))

const { createAdminRouter } = await import('../../routes/admin.js')

const listOrders = vi.fn()
const getOrder = vi.fn()
const act = vi.fn()
const keyStats = vi.fn()
const importKeys = vi.fn()
const admin = { listOrders, getOrder, act, keyStats, importKeys } as unknown as Admin

const listPromos = vi.fn()
const createPromo = vi.fn()
const setActive = vi.fn()
const promos = { list: listPromos, create: createPromo, setActive } as unknown as Promos

const app = express()
app.use(express.json())
app.use('/api/admin', createAdminRouter(admin, promos))
app.use(notFoundHandler)
app.use(createErrorHandler({ exposeDetails: true, logRefusals: false }))

beforeEach(() => { vi.clearAllMocks() })

describe('GET /api/admin/orders', () => {
  it('lists orders with the parsed query', async () => {
    listOrders.mockResolvedValue([{ reference: 'BMS-0000ABCD', status: 'failed' }])
    const response = await request(app).get('/api/admin/orders?status=failed&limit=10')
    expect(response.status).toBe(200)
    expect(listOrders).toHaveBeenCalledWith({ status: 'failed', limit: 10 })
    expect(bodyOf<{ orders: unknown[] }>(response).orders).toHaveLength(1)
  })

  it('defaults the limit and allows no status', async () => {
    listOrders.mockResolvedValue([])
    await request(app).get('/api/admin/orders')
    expect(listOrders).toHaveBeenCalledWith({ limit: 50 })
  })

  it('rejects an unknown status', async () => {
    const response = await request(app).get('/api/admin/orders?status=nonsense')
    expect(response.status).toBe(422)
    expect(listOrders).not.toHaveBeenCalled()
  })
})

describe('GET /api/admin/orders/:reference', () => {
  it('returns the order detail', async () => {
    getOrder.mockResolvedValue({ reference: 'BMS-0000ABCD' })
    const response = await request(app).get('/api/admin/orders/BMS-0000ABCD')
    expect(response.status).toBe(200)
    expect(getOrder).toHaveBeenCalledWith('BMS-0000ABCD')
  })

  it('rejects a malformed reference', async () => {
    const response = await request(app).get('/api/admin/orders/not-a-ref')
    expect(response.status).toBe(422)
  })

  it('surfaces a service rejection through the error handler', async () => {
    getOrder.mockRejectedValue(new AppError('NOT_FOUND', 'gone'))
    const response = await request(app).get('/api/admin/orders/BMS-0000ABCD')
    expect(response.status).toBe(404)
  })
})

describe('POST /api/admin/orders/:reference/action', () => {
  it('runs a valid action', async () => {
    act.mockResolvedValue({ reference: 'BMS-0000ABCD', status: 'paid' })
    const response = await request(app).post('/api/admin/orders/BMS-0000ABCD/action').send({ action: 'retry' })
    expect(response.status).toBe(200)
    expect(act).toHaveBeenCalledWith('BMS-0000ABCD', 'retry')
  })

  it('rejects an unknown action', async () => {
    const response = await request(app).post('/api/admin/orders/BMS-0000ABCD/action').send({ action: 'explode' })
    expect(response.status).toBe(422)
    expect(act).not.toHaveBeenCalled()
  })
})

describe('admin keys routes', () => {
  it('returns the key stats', async () => {
    keyStats.mockResolvedValue([{ plan: 'lifetime', total: 1, available: 1, used: 0 }])
    const response = await request(app).get('/api/admin/keys')
    expect(response.status).toBe(200)
    expect(bodyOf<{ keys: unknown[] }>(response).keys).toHaveLength(1)
  })

  it('imports pasted keys', async () => {
    importKeys.mockResolvedValue({ imported: 2, skipped: 0 })
    const response = await request(app).post('/api/admin/keys').send({ plan: 'lifetime', keys: 'K1\nK2' })
    expect(response.status).toBe(201)
    expect(importKeys).toHaveBeenCalledWith({ plan: 'lifetime', raw: 'K1\nK2' })
  })

  it('rejects an import with no keys', async () => {
    const response = await request(app).post('/api/admin/keys').send({ plan: 'lifetime', keys: '' })
    expect(response.status).toBe(422)
    expect(importKeys).not.toHaveBeenCalled()
  })
})

describe('admin promos routes', () => {
  it('lists promo codes', async () => {
    listPromos.mockResolvedValue([{ code: 'SAVE25' }])
    const response = await request(app).get('/api/admin/promos')
    expect(response.status).toBe(200)
    expect(bodyOf<{ promos: unknown[] }>(response).promos).toHaveLength(1)
  })

  it('creates a promo code', async () => {
    createPromo.mockResolvedValue({ code: 'SAVE25' })
    const response = await request(app).post('/api/admin/promos').send({ code: 'save25', kind: 'percent', value: 25 })
    expect(response.status).toBe(201)
    expect(createPromo).toHaveBeenCalledWith({ code: 'save25', kind: 'percent', value: 25 })
  })

  it('rejects a percentage above 100', async () => {
    const response = await request(app).post('/api/admin/promos').send({ code: 'BIG', kind: 'percent', value: 150 })
    expect(response.status).toBe(422)
    expect(createPromo).not.toHaveBeenCalled()
  })

  it('toggles a promo code active flag', async () => {
    setActive.mockResolvedValue({ code: 'SAVE25', active: false })
    const id = '11111111-1111-4111-8111-111111111111'
    const response = await request(app).post(`/api/admin/promos/${id}/active`).send({ active: false })
    expect(response.status).toBe(200)
    expect(setActive).toHaveBeenCalledWith(id, false)
  })

  it('rejects a non-uuid promo id', async () => {
    const response = await request(app).post('/api/admin/promos/not-a-uuid/active').send({ active: false })
    expect(response.status).toBe(422)
    expect(setActive).not.toHaveBeenCalled()
  })
})
