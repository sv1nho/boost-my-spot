import { z } from 'zod'

// The upstream publishes no response schemas. These shapes are provisional:
// scripts/fake-upstream.ts answers with exactly this contract, and phase 0 (the
// first real key) reconciles both this parser and the fake with reality.

type UpgraderErrorReason =
  | 'cookie_rejected'
  | 'out_of_stock'
  | 'rate_limited'
  | 'transient'
  | 'rejected'

type StockResult = { countries: Record<string, number> }

type KeyInfo = { status: string; username: string | null; country: string | null }

type UpgradeResult =
  | { ok: true; account: string | null }
  | { ok: false; reason: UpgraderErrorReason; message: string; retryAfter: number | null }

export type Upgrader = {
  stock: () => Promise<StockResult>
  info: (key: string) => Promise<KeyInfo>
  upgrade: (input: { key: string; spDc: string; country: string }) => Promise<UpgradeResult>
  renew: (input: { key: string; spDc: string; country?: string; checkBanned?: boolean }) => Promise<UpgradeResult>
}

type Deps = {
  fetch: typeof fetch
  baseUrl: string
  apiKey: string
  timeoutMs?: number
}

const DEFAULT_TIMEOUT = 15_000

const stockSchema = z.object({
  stock: z.record(z.string(), z.number().int().nonnegative()),
})

const keyInfoSchema = z.object({
  key: z.object({
    status: z.string(),
    username: z.string().nullable().default(null),
    country: z.string().nullable().default(null),
  }),
})

const successSchema = z.object({
  status: z.literal('success'),
  account: z.string().nullable().default(null),
})

const errorSchema = z.object({
  status: z.literal('error'),
  message: z.string().default(''),
  code: z.string().optional(),
  retry_after: z.number().int().nonnegative().optional(),
})

const REASONS: Record<string, UpgraderErrorReason> = {
  cookie_rejected: 'cookie_rejected',
  invalid_cookie: 'cookie_rejected',
  out_of_stock: 'out_of_stock',
  no_stock: 'out_of_stock',
}

const reasonFrom = (code: string | undefined, httpStatus: number): UpgraderErrorReason => {
  if (code !== undefined && code in REASONS) return REASONS[code]
  if (httpStatus === 429) return 'rate_limited'
  if (httpStatus >= 500) return 'transient'
  return 'rejected'
}

export function createUpgrader ({ fetch, baseUrl, apiKey, timeoutMs = DEFAULT_TIMEOUT }: Deps): Upgrader {
  const call = async (path: string, init: RequestInit = {}): Promise<{ status: number; body: unknown }> => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'X-API-Key': apiKey,
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...init.headers,
      },
    })

    return { status: response.status, body: await response.json() }
  }

  const post = (path: string, payload: unknown): Promise<{ status: number; body: unknown }> =>
    call(path, { method: 'POST', body: JSON.stringify(payload) })

  const settle = (status: number, body: unknown): UpgradeResult => {
    const success = successSchema.safeParse(body)
    if (status < 400 && success.success) return { ok: true, account: success.data.account }

    const failure = errorSchema.safeParse(body)
    const message = failure.success ? failure.data.message : 'The upgrade could not be completed.'
    const code = failure.success ? failure.data.code : undefined
    const retryAfter = failure.success ? failure.data.retry_after ?? null : null

    return { ok: false, reason: reasonFrom(code, status), message, retryAfter }
  }

  const run = async (path: string, payload: unknown): Promise<UpgradeResult> => {
    try {
      const { status, body } = await post(path, payload)
      return settle(status, body)
    } catch {
      return { ok: false, reason: 'transient', message: 'The upstream could not be reached.', retryAfter: null }
    }
  }

  return {
    stock: async () => {
      const { body } = await call('/stock')
      return { countries: stockSchema.parse(body).stock }
    },
    info: async (key) => {
      const { body } = await post('/info', { key })
      return keyInfoSchema.parse(body).key
    },
    upgrade: ({ key, spDc, country }) => run('/upgrade', { key, sp_dc: spDc, country }),
    renew: ({ key, spDc, country, checkBanned }) =>
      run('/renew', { key, sp_dc: spDc, country, check_banned: checkBanned }),
  }
}
