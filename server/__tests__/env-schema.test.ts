import { describe, it, expect } from 'vitest'
import { envSchema } from '../env-schema.js'

const dev = (overrides: Record<string, string> = {}): Record<string, string> => ({
  DATABASE_URL: 'postgresql://u:p@127.0.0.1:5434/boost_my_spot',
  WEB_ORIGIN: 'http://localhost:5174',
  BETTER_AUTH_URL: 'http://localhost:5174',
  BETTER_AUTH_SECRET: 'a-secret-that-is-at-least-32-characters',
  ...overrides,
})

const prod = (overrides: Record<string, string> = {}): Record<string, string> => ({
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://u:p@db/boost_my_spot',
  WEB_ORIGIN: 'https://boostmyspot.example',
  BETTER_AUTH_URL: 'https://boostmyspot.example',
  BETTER_AUTH_SECRET: 'a-secret-that-is-at-least-32-characters',
  GOOGLE_CLIENT_ID: 'id',
  GOOGLE_CLIENT_SECRET: 'secret',
  SECRET_BOX_KEY: '0'.repeat(64),
  ORDER_LINK_SECRET: 'order-link-secret-at-least-32-characters',
  UPGRADER_API_URL: 'https://upgrader.example',
  UPGRADER_API_KEY: 'k',
  NOWPAYMENTS_API_URL: 'https://nowpayments.example',
  NOWPAYMENTS_API_KEY: 'k',
  NOWPAYMENTS_IPN_SECRET: 'k',
  RESEND_API_URL: 'https://resend.example',
  RESEND_API_KEY: 'k',
  MAIL_FROM: 'orders@boostmyspot.example',
  ADMIN_EMAILS: 'admin@boostmyspot.example',
  ...overrides,
})

const paths = (input: Record<string, string>): string[] => {
  const result = envSchema.safeParse(input)
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))
}

describe('env schema', () => {
  it('accepts a minimal development environment and applies defaults', () => {
    const result = envSchema.safeParse(dev())
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.API_PORT).toBe(3000)
      expect(result.data.E2E_AUTH).toBe(false)
      expect(result.data.RATE_LIMIT_PER_MINUTE).toBe(120)
    }
  })

  it('turns the E2E flag into a boolean', () => {
    const result = envSchema.safeParse(dev({ E2E_AUTH: 'true' }))
    expect(result.success && result.data.E2E_AUTH).toBe(true)
  })

  it('rejects a non-postgres url, a bad origin and a short secret', () => {
    expect(paths(dev({ DATABASE_URL: 'mysql://x' }))).toContain('DATABASE_URL')
    expect(paths(dev({ WEB_ORIGIN: 'not-a-url' }))).toContain('WEB_ORIGIN')
    expect(paths(dev({ BETTER_AUTH_SECRET: 'short' }))).toContain('BETTER_AUTH_SECRET')
  })

  it('wants both halves of the oauth pair or neither', () => {
    expect(paths(dev({ GOOGLE_CLIENT_ID: 'id' }))).toContain('GOOGLE_CLIENT_SECRET')
    expect(paths(dev({ GOOGLE_CLIENT_SECRET: 'secret' }))).toContain('GOOGLE_CLIENT_ID')
  })

  it('checks the secret-box key and the link secret', () => {
    expect(paths(dev({ SECRET_BOX_KEY: 'nothex' }))).toContain('SECRET_BOX_KEY')
    expect(paths(dev({ ORDER_LINK_SECRET: 'tooshort' }))).toContain('ORDER_LINK_SECRET')
  })

  it('accepts a complete production environment', () => {
    expect(envSchema.safeParse(prod()).success).toBe(true)
  })

  it('demands the production essentials', () => {
    expect(paths(prod({ E2E_AUTH: 'true' }))).toContain('E2E_AUTH')
    expect(paths({ ...prod(), GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' })).toContain('GOOGLE_CLIENT_ID')
    expect(paths(prod({ WEB_ORIGIN: 'http://insecure' }))).toContain('WEB_ORIGIN')
    expect(paths(prod({ UPGRADER_API_URL: 'http://insecure' }))).toContain('UPGRADER_API_URL')
    expect(paths({ ...prod(), SECRET_BOX_KEY: '' })).toContain('SECRET_BOX_KEY')
    expect(paths({ ...prod(), ADMIN_EMAILS: '' })).toContain('ADMIN_EMAILS')
  })
})
