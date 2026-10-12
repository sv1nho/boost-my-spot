import { describe, it, expect, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createCatalogRouter } from '../../routes/catalog.js'
import { createErrorHandler, notFoundHandler } from '../../middleware/error-handler.js'
import { bodyOf } from './http.js'
import type { Orders } from '../../services/orders/index.js'

const catalog = vi.fn()
const orders = { catalog } as unknown as Orders

const app = express()
app.use(express.json())
app.use('/api/catalog', createCatalogRouter(orders))
app.use(notFoundHandler)
app.use(createErrorHandler({ exposeDetails: true, logRefusals: false }))

describe('GET /api/catalog', () => {
  it('returns the plans and the available countries', async () => {
    catalog.mockResolvedValue({
      plans: [{ id: 'lifetime', label: 'Lifetime', priceCents: 2000, currency: 'EUR' }],
      countries: ['US', 'GB'],
    })
    const response = await request(app).get('/api/catalog')
    expect(response.status).toBe(200)
    const catalogBody = bodyOf<{ countries: string[]; plans: { priceCents: number }[] }>(response)
    expect(catalogBody.countries).toEqual(['US', 'GB'])
    expect(catalogBody.plans[0].priceCents).toBe(2000)
  })
})
