import { Router } from 'express'
import type { Request, RequestHandler, Response } from 'express'
import { requireUser } from '../auth/require-user.js'
import { parse } from './validate.js'
import { adminActionSchema, adminOrdersQuerySchema, importKeysSchema, referenceParamSchema } from './schemas.js'
import type { Admin } from '../services/admin/index.js'

const handle =
  (run: (req: Request, res: Response) => Promise<void>): RequestHandler =>
    (req, res, next) => {
      run(req, res).catch(next)
    }

const referenceOf = (req: Request): string => parse(referenceParamSchema, req.params, 'params').reference

export const createAdminRouter = (admin: Admin): Router => {
  const router = Router()

  router.use(requireUser)

  router.get(
    '/orders',
    handle(async (req, res) => {
      const query = parse(adminOrdersQuerySchema, req.query, 'query')
      res.json({ orders: await admin.listOrders(query) })
    })
  )

  router.get(
    '/orders/:reference',
    handle(async (req, res) => {
      res.json(await admin.getOrder(referenceOf(req)))
    })
  )

  router.post(
    '/orders/:reference/action',
    handle(async (req, res) => {
      const { action } = parse(adminActionSchema, req.body, 'body')
      res.json(await admin.act(referenceOf(req), action))
    })
  )

  router.get(
    '/keys',
    handle(async (_req, res) => {
      res.json({ keys: await admin.keyStats() })
    })
  )

  router.post(
    '/keys',
    handle(async (req, res) => {
      const body = parse(importKeysSchema, req.body, 'body')
      res.status(201).json(await admin.importKeys({ plan: body.plan, raw: body.keys }))
    })
  )

  return router
}
