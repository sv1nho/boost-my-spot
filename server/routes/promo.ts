import { Router } from 'express'
import type { Request, RequestHandler, Response } from 'express'
import { parse } from './validate.js'
import { previewPromoSchema } from './schemas.js'
import { PLANS } from '../../shared/plans.js'
import type { Promos } from '../services/promo/index.js'

const handle =
  (run: (req: Request, res: Response) => Promise<void>): RequestHandler =>
    (req, res, next) => {
      run(req, res).catch(next)
    }

export const createPromoRouter = (promos: Promos): Router => {
  const router = Router()

  router.post(
    '/',
    handle(async (req, res) => {
      const { code, plan } = parse(previewPromoSchema, req.body, 'body')
      res.json(await promos.preview(code, PLANS[plan].priceCents))
    })
  )

  return router
}
