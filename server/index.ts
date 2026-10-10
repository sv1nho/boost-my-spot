import { createApp } from './app.js'
import { env } from './env.js'
import { enabledProviders } from './auth/auth.js'
import { prisma } from './prisma.js'
import { log } from './log.js'

const app = createApp()

if (enabledProviders.length === 0) {
  log('warn', 'sign-in is disabled, no OAuth provider is configured')
} else {
  log('info', 'sign-in is ready', { providers: enabledProviders.join(',') })
}

const server = app.listen(env.API_PORT, env.API_HOST, () => {
  log('info', 'listening', { host: env.API_HOST, port: env.API_PORT, mode: env.NODE_ENV })
})

const GIVE_UP_AFTER = 10_000

const shutdown = (signal: string): void => {
  log('info', 'shutting down', { signal })

  const giveUp = setTimeout(() => {
    log('warn', 'a connection would not close in time, leaving anyway')
    process.exit(1)
  }, GIVE_UP_AFTER)

  giveUp.unref()

  server.close(() => {
    void prisma.$disconnect().finally(() => {
      process.exit(0)
    })
  })
}

process.on('SIGINT', () => {
  shutdown('SIGINT')
})
process.on('SIGTERM', () => {
  shutdown('SIGTERM')
})
