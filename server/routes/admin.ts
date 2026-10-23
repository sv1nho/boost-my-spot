import { Router } from 'express'
import type { Request, RequestHandler, Response } from 'express'
import { requireUser } from '../auth/require-user.js'
import { parse } from './validate.js'
import {
  adminActionSchema, adminOrdersQuerySchema, createPromoSchema, importKeysSchema,
  promoActiveSchema, promoIdParamSchema, referenceParamSchema,
} from './schemas.js'
import type { Admin } from '../services/admin/index.js'
import type { Promos } from '../services/promo/index.js'

const handle =
  (run: (req: Request, res: Response) => Promise<void>): RequestHandler =>
    (req, res, next) => {
      run(req, res).catch(next)
    }

const referenceOf = (req: Request): string => parse(referenceParamSchema, req.params, 'params').reference

export const createAdminRouter = (admin: Admin, promos: Promos): Router => {
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

  router.get(
    '/promos',
    handle(async (_req, res) => {
      res.json({ promos: await promos.list() })
    })
  )

  router.post(
    '/promos',
    handle(async (req, res) => {
      res.status(201).json(await promos.create(parse(createPromoSchema, req.body, 'body')))
    })
  )

  router.post(
    '/promos/:id/active',
    handle(async (req, res) => {
      const { id } = parse(promoIdParamSchema, req.params, 'params')
      const { active } = parse(promoActiveSchema, req.body, 'body')
      res.json(await promos.setActive(id, active))
    })
  )

  return router
}
