import { rateLimit } from 'express-rate-limit'
import type { RequestHandler } from 'express'
import { localeOf, translate } from '../i18n/translate.js'

const WINDOW_SECONDS = 60

const TOO_MANY = 'Too many requests. Wait a moment before trying again.'

export function createApiLimiter (limit: number): RequestHandler {
  return rateLimit({
    windowMs: WINDOW_SECONDS * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: translate(localeOf(req.get('accept-language')), TOO_MANY),
          details: null,
        },
      })
    },
  })
}
