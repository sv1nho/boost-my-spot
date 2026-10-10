import { resolve } from 'node:path'
import express from 'express'
import type { Express } from 'express'
import compression from 'compression'
import { toNodeHandler } from 'better-auth/node'
import { auth, enabledProviders } from './auth/auth.js'
import { createErrorHandler, notFoundHandler } from './middleware/error-handler.js'
import { createApiLimiter } from './middleware/rate-limit.js'
import { createOriginGuard } from './middleware/same-origin.js'
import { requestLog } from './middleware/request-log.js'
import { cacheBuiltFiles, createSecurityHeaders, createWebAppFallback } from './middleware/web-app.js'
import { prisma } from './prisma.js'
import { env, isDevelopment, isProduction } from './env.js'

const WEB_APP_ROOT = resolve('dist', 'web')

export function createApp (): Express {
  const app = express()

  app.disable('x-powered-by')

  if (env.TRUSTED_PROXY_HOPS > 0) app.set('trust proxy', env.TRUSTED_PROXY_HOPS)

  app.use('/api', requestLog)

  app.use(createSecurityHeaders(isProduction))
  app.use(compression())

  app.all('/api/auth/{*any}', toNodeHandler(auth))

  app.use(express.json({ limit: '256kb' }))

  app.get('/api/health', (_req, res, next) => {
    prisma.$queryRaw`SELECT 1`
      .then(() => {
        res.json({ status: 'ok', database: 'up' })
      })
      .catch(next)
  })

  app.get('/api/config', (_req, res) => {
    res.json({ providers: enabledProviders })
  })

  app.use(express.static(WEB_APP_ROOT, { index: false, setHeaders: cacheBuiltFiles }))

  app.use('/api', createApiLimiter(env.RATE_LIMIT_PER_MINUTE))
  app.use('/api', createOriginGuard(env.WEB_ORIGIN))

  app.use(createWebAppFallback(WEB_APP_ROOT))

  app.use(notFoundHandler)
  app.use(createErrorHandler({ exposeDetails: !isProduction, logRefusals: isDevelopment }))

  return app
}
