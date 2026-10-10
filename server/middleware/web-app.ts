import { join, sep } from 'node:path'
import type { RequestHandler } from 'express'
import helmet from 'helmet'

const YEAR_IN_SECONDS = 31_536_000
const HALF_YEAR_IN_SECONDS = 15_552_000

export function createSecurityHeaders (overHttps: boolean): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:'],
        'connect-src': ["'self'"],
        'frame-src': ["'self'", 'blob:'],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
      },
    },
    hsts: overHttps ? { maxAge: HALF_YEAR_IN_SECONDS, includeSubDomains: true } : false,
    referrerPolicy: { policy: 'same-origin' },
  })
}

export const cacheBuiltFiles = (res: { setHeader: (name: string, value: string) => void }, path: string): void => {
  const hashedAsset = path.includes(`${sep}assets${sep}`)

  res.setHeader(
    'Cache-Control',
    hashedAsset ? `public, max-age=${String(YEAR_IN_SECONDS)}, immutable` : 'no-cache'
  )
}

export function createWebAppFallback (root: string): RequestHandler {
  return (req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) {
      next()
      return
    }

    res.sendFile(join(root, 'index.html'), (error) => {
      if (error) next()
    })
  }
}
