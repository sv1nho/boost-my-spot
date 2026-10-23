import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { AppError } from '../../errors.js'
import { createErrorHandler, notFoundHandler } from '../../middleware/error-handler.js'
import { createPromoRouter } from '../../routes/promo.js'
import { bodyOf } from './http.js'
import type { Promos } from '../../services/promo/index.js'

const preview = vi.fn()
const promos = { preview } as unknown as Promos

const app = express()
app.use(express.json())
app.use('/api/promo', createPromoRouter(promos))
app.use(notFoundHandler)
app.use(createErrorHandler({ exposeDetails: true, logRefusals: false }))

beforeEach(() => { vi.clearAllMocks() })

describe('POST /api/promo', () => {
  it('previews a code against the plan price', async () => {
    preview.mockResolvedValue({ code: 'SAVE25', discountCents: 500, finalCents: 1500 })
    const response = await request(app).post('/api/promo').send({ code: 'save25', plan: 'lifetime' })
    expect(response.status).toBe(200)
    expect(preview).toHaveBeenCalledWith('save25', 2000)
    expect(bodyOf<{ finalCents: number }>(response).finalCents).toBe(1500)
  })

  it('surfaces an invalid code as a 400', async () => {
    preview.mockRejectedValue(new AppError('BAD_REQUEST', 'This promo code cannot be used.'))
    const response = await request(app).post('/api/promo').send({ code: 'nope', plan: 'lifetime' })
    expect(response.status).toBe(400)
  })

  it('rejects a missing code', async () => {
    const response = await request(app).post('/api/promo').send({ plan: 'lifetime' })
    expect(response.status).toBe(422)
    expect(preview).not.toHaveBeenCalled()
  })
})
