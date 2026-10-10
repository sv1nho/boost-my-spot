import { randomUUID } from 'node:crypto'
import type { RequestHandler } from 'express'
import { log } from '../log.js'

const PLAIN_ID = /^[\w-]{1,64}$/

const idOf = (given: string | undefined): string =>
  given !== undefined && PLAIN_ID.test(given) ? given : randomUUID()

export const requestLog: RequestHandler = (req, res, next) => {
  const id = idOf(req.get('x-request-id'))
  const started = performance.now()

  req.requestId = id
  res.setHeader('x-request-id', id)

  res.on('finish', () => {
    log(res.statusCode >= 500 ? 'error' : 'info', 'request', {
      request: id,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      ms: Math.round(performance.now() - started),
      user: req.user?.id,
    })
  })

  next()
}
