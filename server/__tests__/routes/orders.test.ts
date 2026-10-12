import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createOrdersRouter } from '../../routes/orders.js'
import { createErrorHandler, notFoundHandler } from '../../middleware/error-handler.js'
import { AppError } from '../../errors.js'
import { bodyOf } from './http.js'
import type { ApiError } from './http.js'
import type { Orders } from '../../services/orders/index.js'

const view = {
  reference: 'BMS-0000ABCD', status: 'awaiting_payment', plan: 'lifetime', country: 'US',
  priceCents: 2000, currency: 'EUR', spotifyAccount: null, lastError: null,
  createdAt: '2026-10-12T10:00:00.000Z', paidAt: null, activatedAt: null,
}

const create = vi.fn()
const lookup = vi.fn()
const viewFn = vi.fn()
const submitSpotify = vi.fn()
const orders = {
  catalog: vi.fn(),
  create,
  view: viewFn,
  lookup,
  applyPayment: vi.fn(),
  submitSpotify,
} as unknown as Orders

const app = express()
app.use(express.json())
app.use('/api/orders', createOrdersRouter(orders))
app.use(notFoundHandler)
app.use(createErrorHandler({ exposeDetails: true, logRefusals: false }))

beforeEach(() => {
  vi.clearAllMocks()
})

const body = { plan: 'lifetime', country: 'US', email: 'buyer@example.com', spDc: 'AQA-the-cookie-value' }

describe('POST /api/orders', () => {
  it('creates an order and returns the token and payment url', async () => {
    create.mockResolvedValue({ token: 'tok', paymentUrl: 'https://pay.test/1' })
    const response = await request(app).post('/api/orders').send(body)
    expect(response.status).toBe(201)
    expect(response.body).toEqual({ token: 'tok', paymentUrl: 'https://pay.test/1' })
    expect(create).toHaveBeenCalledWith({ ...body, locale: 'en' })
  })

  it('refuses a body that does not validate', async () => {
    const response = await request(app).post('/api/orders').send({ ...body, email: 'not-an-email' })
    expect(response.status).toBe(422)
    expect(bodyOf<ApiError>(response).error.code).toBe('VALIDATION_ERROR')
    expect(create).not.toHaveBeenCalled()
  })

  it('passes a service refusal through as its status', async () => {
    create.mockRejectedValue(new AppError('CONFLICT', 'That country is out of stock right now.'))
    const response = await request(app).post('/api/orders').send(body)
    expect(response.status).toBe(409)
    expect(bodyOf<ApiError>(response).error.code).toBe('CONFLICT')
  })
})

describe('GET /api/orders/:token', () => {
  it('returns the order view', async () => {
    viewFn.mockResolvedValue(view)
    const response = await request(app).get('/api/orders/some-token')
    expect(response.status).toBe(200)
    expect(response.body).toEqual(view)
    expect(viewFn).toHaveBeenCalledWith('some-token')
  })

  it('maps a not-found order to 404', async () => {
    viewFn.mockRejectedValue(new AppError('NOT_FOUND', 'This order could not be found.'))
    const response = await request(app).get('/api/orders/missing')
    expect(response.status).toBe(404)
  })
})

describe('POST /api/orders/lookup', () => {
  it('returns a token for a valid number and email', async () => {
    lookup.mockResolvedValue({ token: 'tok' })
    const response = await request(app).post('/api/orders/lookup').send({ reference: 'BMS-0000ABCD', email: 'buyer@example.com' })
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ token: 'tok' })
  })

  it('refuses a malformed order number', async () => {
    const response = await request(app).post('/api/orders/lookup').send({ reference: 'nope', email: 'buyer@example.com' })
    expect(response.status).toBe(422)
    expect(lookup).not.toHaveBeenCalled()
  })
})

describe('POST /api/orders/:token/spotify', () => {
  it('submits a new cookie and returns the updated view', async () => {
    submitSpotify.mockResolvedValue({ ...view, status: 'paid' })
    const response = await request(app).post('/api/orders/some-token/spotify').send({ spDc: 'AQA-new-cookie' })
    expect(response.status).toBe(200)
    expect(bodyOf<{ status: string }>(response).status).toBe('paid')
    expect(submitSpotify).toHaveBeenCalledWith('some-token', 'AQA-new-cookie')
  })

  it('maps a wrong-state submission to 409', async () => {
    submitSpotify.mockRejectedValue(new AppError('CONFLICT', 'This order is not waiting for a session key.'))
    const response = await request(app).post('/api/orders/some-token/spotify').send({ spDc: 'AQA-new-cookie' })
    expect(response.status).toBe(409)
  })
})
