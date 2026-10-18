import { describe, it, expect } from 'vitest'
import { createUpgrader } from '../../services/upgrader.js'

type Handler = (url: string, init: RequestInit) => unknown

const makeFetch = (handler: Handler) => {
  const calls: { url: string; init: RequestInit }[] = []
  const fn = ((url: string, init: RequestInit = {}) => {
    calls.push({ url, init })
    const body = handler(url, init)
    if (body instanceof Error) return Promise.reject(body)
    const { status = 200, payload } = body as { status?: number; payload: unknown }
    return Promise.resolve({ status, ok: status < 400, json: () => Promise.resolve(payload) } as unknown as Response)
  }) as unknown as typeof fetch
  return { fn, calls }
}

const upgrader = (handler: Handler) => {
  const { fn, calls } = makeFetch(handler)
  return { client: createUpgrader({ fetch: fn, baseUrl: 'https://up.test/api', apiKey: 'k' }), calls }
}

describe('upgrader adapter', () => {
  it('reads stock per country', async () => {
    const { client } = upgrader(() => ({ payload: { stock: { US: 10, DE: 0 } } }))
    expect(await client.stock()).toEqual({ countries: { US: 10, DE: 0 } })
  })

  it('reads a key status', async () => {
    const { client } = upgrader(() => ({ payload: { key: { status: 'active', username: 'bob', country: 'US' } } }))
    expect(await client.info('abc')).toEqual({ status: 'active', username: 'bob', country: 'US' })
  })

  it('sends the cookie and key, and returns the account on success', async () => {
    const { client, calls } = upgrader(() => ({ payload: { status: 'success', account: 'u@e.com' } }))
    const result = await client.upgrade({ key: 'K', spDc: 'COOKIE', country: 'US' })
    expect(result).toEqual({ ok: true, account: 'u@e.com' })
    expect(calls[0].url).toBe('https://up.test/api/upgrade')
    expect((calls[0].init.headers as Record<string, string>)['X-API-Key']).toBe('k')
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ key: 'K', sp_dc: 'COOKIE', country: 'US' })
  })

  it('classifies a rejected cookie', async () => {
    const { client } = upgrader(() => ({ status: 400, payload: { status: 'error', message: 'bad', code: 'cookie_rejected' } }))
    expect(await client.upgrade({ key: 'K', spDc: 'x', country: 'US' })).toEqual({
      ok: false, reason: 'cookie_rejected', message: 'bad', retryAfter: null,
    })
  })

  it('classifies a plain refusal with no code as rejected', async () => {
    const { client } = upgrader(() => ({ status: 400, payload: { status: 'error', message: 'no' } }))
    const result = await client.upgrade({ key: 'K', spDc: 'x', country: 'US' })
    expect(result.ok ? null : result.reason).toBe('rejected')
  })

  it('classifies a rate limit and keeps retry_after', async () => {
    const { client } = upgrader(() => ({ status: 429, payload: { status: 'error', message: 'slow', retry_after: 1742 } }))
    expect(await client.upgrade({ key: 'K', spDc: 'x', country: 'US' })).toEqual({
      ok: false, reason: 'rate_limited', message: 'slow', retryAfter: 1742,
    })
  })

  it('falls back when the error body is not recognisable', async () => {
    const { client } = upgrader(() => ({ status: 500, payload: {} }))
    expect(await client.upgrade({ key: 'K', spDc: 'x', country: 'US' })).toEqual({
      ok: false, reason: 'transient', message: 'The upgrade could not be completed.', retryAfter: null,
    })
  })

  it('treats a server error and an unreachable upstream as transient', async () => {
    const serverError = upgrader(() => ({ status: 503, payload: { status: 'error', message: 'oops' } }))
    const failed = await serverError.client.upgrade({ key: 'K', spDc: 'x', country: 'US' })
    expect(failed.ok ? null : failed.reason).toBe('transient')

    const unreachable = upgrader(() => new Error('ECONNREFUSED'))
    const unreachableResult = await unreachable.client.renew({ key: 'K', spDc: 'x' })
    expect(unreachableResult.ok ? null : unreachableResult.reason).toBe('transient')
  })
})
