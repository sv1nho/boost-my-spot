import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from '../prisma.js'
import { env, isProduction } from '../env.js'
import { resolveEnabledProviders } from './resolve-providers.js'
import type { ProviderCredentials } from './resolve-providers.js'

const credentials: ProviderCredentials = {
  google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
  github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET },
}

export const enabledProviders = resolveEnabledProviders(credentials)

const socialProviders = Object.fromEntries(
  enabledProviders.map((id) => [
    id,
    {
      clientId: credentials[id].clientId as string,
      clientSecret: credentials[id].clientSecret as string,
    },
  ])
)

export const auth = betterAuth({
  appName: 'boost-my-spot',
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  basePath: '/api/auth',
  trustedOrigins: [env.WEB_ORIGIN],

  database: prismaAdapter(prisma, { provider: 'postgresql' }),

  emailAndPassword: { enabled: env.E2E_AUTH },

  user: {
    deleteUser: { enabled: true },
  },

  socialProviders,

  account: {
    accountLinking: {
      enabled: true,
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },

  advanced: {
    cookiePrefix: 'boostmyspot',
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
    },
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    customRules: {
      '/get-session': { window: 60, max: 300 },
    },
  },
})

export type AuthUser = {
  id: string
  email: string
  name: string
  image: string | null
}
