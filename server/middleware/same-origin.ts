import type { RequestHandler } from 'express'
import { AppError } from '../errors.js'

const READING = new Set(['GET', 'HEAD', 'OPTIONS'])

export function createOriginGuard (allowed: string): RequestHandler {
  return (req, _res, next) => {
    const origin = req.get('origin')

    if (READING.has(req.method) || origin === undefined || origin === allowed) {
      next()
      return
    }

    next(new AppError('FORBIDDEN', 'This request did not come from boost-my-spot.'))
  }
}
