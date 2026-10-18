import express, { Router } from 'express'
import type { Request, RequestHandler, Response } from 'express'
import { AppError } from '../errors.js'
import type { Orders } from '../services/orders/index.js'
import type { PaymentProvider } from '../services/payments/provider.js'

const handle =
  (run: (req: Request, res: Response) => Promise<void>): RequestHandler =>
    (req, res, next) => {
      run(req, res).catch(next)
    }

export const createPaymentsRouter = (orders: Orders, payments: PaymentProvider): Router => {
  const router = Router()

  router.post(
    '/nowpayments',
    express.raw({ type: '*/*', limit: '256kb' }),
    handle(async (req, res) => {
      const signature = req.header('x-nowpayments-sig') ?? ''
      const rawBody = (req.body as Buffer).toString('utf8')

      const notification = payments.verifyNotification(rawBody, signature)
      if (notification === null) {
        throw new AppError('BAD_REQUEST', 'This notification could not be verified.')
      }

      await orders.applyPayment(notification)
      res.status(204).end()
    })
  )

  return router
}
