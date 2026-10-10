import type { Request, RequestHandler } from 'express'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from './auth.js'
import type { AuthUser } from './auth.js'
import { AppError } from '../errors.js'

export const requireUser: RequestHandler = (req, _res, next) => {
  auth.api
    .getSession({ headers: fromNodeHeaders(req.headers) })
    .then((session) => {
      if (!session) {
        next(new AppError('UNAUTHORIZED', 'Authentication required.'))
        return
      }

      req.user = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image ?? null,
      }
      next()
    })
    .catch(next)
}

export function currentUser (req: Request): AuthUser {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'Authentication required.')
  }
  return req.user
}
