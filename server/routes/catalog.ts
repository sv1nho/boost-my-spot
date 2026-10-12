import { Router } from 'express'
import type { Request, RequestHandler, Response } from 'express'
import type { Orders } from '../services/orders/index.js'

const handle =
  (run: (req: Request, res: Response) => Promise<void>): RequestHandler =>
    (req, res, next) => {
      run(req, res).catch(next)
    }

export const createCatalogRouter = (orders: Orders): Router => {
  const router = Router()

  router.get(
    '/',
    handle(async (_req, res) => {
      res.json(await orders.catalog())
    })
  )

  return router
}
