import { Router } from 'express'
import type { Request, RequestHandler, Response } from 'express'
import { parse } from './validate.js'
import { createOrderSchema, lookupSchema, submitSpotifySchema, tokenParamSchema } from './schemas.js'
import type { Orders } from '../services/orders/index.js'

const handle =
  (run: (req: Request, res: Response) => Promise<void>): RequestHandler =>
    (req, res, next) => {
      run(req, res).catch(next)
    }

const tokenOf = (req: Request): string => parse(tokenParamSchema, req.params, 'params').token

export const createOrdersRouter = (orders: Orders): Router => {
  const router = Router()

  router.post(
    '/',
    handle(async (req, res) => {
      const body = parse(createOrderSchema, req.body, 'body')
      res.status(201).json(await orders.create(body))
    })
  )

  router.post(
    '/lookup',
    handle(async (req, res) => {
      const body = parse(lookupSchema, req.body, 'body')
      res.json(await orders.lookup(body))
    })
  )

  router.get(
    '/:token',
    handle(async (req, res) => {
      res.json(await orders.view(tokenOf(req)))
    })
  )

  router.post(
    '/:token/spotify',
    handle(async (req, res) => {
      const body = parse(submitSpotifySchema, req.body, 'body')
      res.json(await orders.submitSpotify(tokenOf(req), body.spDc))
    })
  )

  return router
}
