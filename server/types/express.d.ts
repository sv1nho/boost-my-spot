import type { AuthUser } from '../auth/auth.js'

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
      requestId?: string
    }
  }
}

export {}
