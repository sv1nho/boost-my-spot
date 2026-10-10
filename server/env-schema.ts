import { z } from 'zod'

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== ''
  } catch {
    return false
  }
}

const httpUrl = z.string().refine(isHttpUrl, {
  message: 'must be an http(s) URL, e.g. http://localhost:5173',
})

const optionalSecret = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(1).optional()
)

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    DATABASE_URL: z
      .string()
      .refine((value) => /^postgres(ql)?:\/\//.test(value), {
        message: 'must be a PostgreSQL URL (postgresql://…)',
      }),

    API_HOST: z.string().min(1).default('127.0.0.1'),
    API_PORT: z.coerce.number().int().min(1024).max(65535).default(3000),

    WEB_ORIGIN: httpUrl,

    TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),

    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(120),

    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

    E2E_AUTH: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),

    BETTER_AUTH_URL: httpUrl,
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, { message: 'must be at least 32 characters, generate one with `openssl rand -base64 32`' }),

    GOOGLE_CLIENT_ID: optionalSecret,
    GOOGLE_CLIENT_SECRET: optionalSecret,

    GITHUB_CLIENT_ID: optionalSecret,
    GITHUB_CLIENT_SECRET: optionalSecret,
  })
  .superRefine((value, ctx) => {
    const pairs = [
      ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
      ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'],
    ] as const

    let configured = 0

    for (const [idKey, secretKey] of pairs) {
      const hasId = value[idKey] !== undefined
      const hasSecret = value[secretKey] !== undefined

      if (hasId && hasSecret) {
        configured += 1
        continue
      }

      if (hasId !== hasSecret) {
        ctx.addIssue({
          code: 'custom',
          path: [hasId ? secretKey : idKey],
          message: 'is required when the other half of the pair is set',
        })
      }
    }

    if (value.NODE_ENV !== 'production') return

    if (value.E2E_AUTH) {
      ctx.addIssue({
        code: 'custom',
        path: ['E2E_AUTH'],
        message: 'cannot be true in production, it opens a password sign-in meant for the browser tests',
      })
    }

    if (configured === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['GOOGLE_CLIENT_ID'],
        message: 'at least one OAuth provider must be configured in production',
      })
    }

    for (const key of ['WEB_ORIGIN', 'BETTER_AUTH_URL'] as const) {
      const url = value[key]
      if (typeof url === 'string' && !url.startsWith('https://')) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'must use https in production, session cookies are set with the Secure flag',
        })
      }
    }
  })
