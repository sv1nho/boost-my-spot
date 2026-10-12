import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createPaymentsRouter } from '../../routes/payments.js'
import { createErrorHandler, notFoundHandler } from '../../middleware/error-handler.js'
import type { Orders } from '../../services/orders/index.js'
import type { PaymentProvider } from '../../services/payments/provider.js'

const applyPayment = vi.fn()
const verifyNotification = vi.fn()
const orders = { applyPayment } as unknown as Orders
const payments = { verifyNotification } as unknown as PaymentProvider

const app = express()
app.use('/api/payments', createPaymentsRouter(orders, payments))
app.use(notFoundHandler)
app.use(createErrorHandler({ exposeDetails: true, logRefusals: false }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/payments/nowpayments', () => {
  it('verifies the raw body and applies a valid notification', async () => {
    const notification = { reference: 'BMS-0000ABCD', status: 'paid', priceAmountCents: 2000, currency: 'EUR' }
    verifyNotification.mockReturnValue(notification)
    applyPayment.mockResolvedValue(undefined)

    const response = await request(app)
      .post('/api/payments/nowpayments')
      .set('Content-Type', 'application/json')
      .set('x-nowpayments-sig', 'the-signature')
      .send('{"order_id":"BMS-0000ABCD"}')

    expect(response.status).toBe(204)
    expect(verifyNotification).toHaveBeenCalledWith('{"order_id":"BMS-0000ABCD"}', 'the-signature')
    expect(applyPayment).toHaveBeenCalledWith(notification)
  })

  it('rejects a notification that does not verify', async () => {
    verifyNotification.mockReturnValue(null)
    const response = await request(app)
      .post('/api/payments/nowpayments')
      .set('Content-Type', 'application/json')
      .send('{}')

    expect(response.status).toBe(400)
    expect(applyPayment).not.toHaveBeenCalled()
  })
})
