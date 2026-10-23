import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  ApiError, buildUrl, errorMessage, refusalMessage, isAbort, askInLocale, request,
} from '../../api/client.js'
import { getCatalog } from '../../api/catalog.js'
import { createOrder, getOrder, lookupOrder, submitSpotify } from '../../api/orders.js'
import { createPromo, getAdminOrder, getKeyStats, importKeys, listAdminOrders, listPromos, runAdminAction, setPromoActive } from '../../api/admin.js'
import { previewPromo } from '../../api/promo.js'

const jsonResponse = (body: unknown, status = 200): Response =>
  ({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  }) as unknown as Response

const spyFetch = () => vi.spyOn(globalThis, 'fetch')

afterEach(() => { vi.restoreAllMocks(); askInLocale('en') })

describe('buildUrl', () => {
  it('keeps zero but drops undefined and empty values', () => {
    expect(buildUrl('/x', { a: 0, b: undefined, c: '', d: 'y' })).toBe('/x?a=0&d=y')
    expect(buildUrl('/x', undefined)).toBe('/x')
    expect(buildUrl('/x', {})).toBe('/x')
  })
})

describe('request', () => {
  it('sends the language header and returns the parsed body', async () => {
    const fetchMock = spyFetch().mockResolvedValue(jsonResponse({ ok: true }))
    askInLocale('fr')
    const body = await request<{ ok: boolean }>('/api/x')
    expect(body).toEqual({ ok: true })
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>)['Accept-Language']).toBe('fr')
  })

  it('serialises a JSON body and sets the content type', async () => {
    const fetchMock = spyFetch().mockResolvedValue(jsonResponse({}))
    await request('/api/x', { method: 'POST', body: { a: 1 } })
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect(init.body).toBe('{"a":1}')
  })

  it('returns undefined on 204', async () => {
    spyFetch().mockResolvedValue(jsonResponse(undefined, 204))
    expect(await request('/api/x', { method: 'DELETE' })).toBeUndefined()
  })

  it('throws a typed ApiError carrying the code, message and details', async () => {
    spyFetch().mockResolvedValue(jsonResponse(
      { error: { code: 'VALIDATION_ERROR', message: 'Nope', details: [{ path: 'email', message: 'bad' }, 'junk'] } },
      422
    ))
    const error = await request('/api/x').catch((cause: unknown) => cause)
    expect(error).toBeInstanceOf(ApiError)
    const api = error as ApiError
    expect(api.code).toBe('VALIDATION_ERROR')
    expect(api.messageFor('email')).toBe('bad')
    expect(api.messageFor('missing')).toBeUndefined()
    expect(api.isConflict).toBe(false)
  })

  it('falls back when the error body is not JSON', async () => {
    spyFetch().mockResolvedValue({
      ok: false, status: 401, json: () => Promise.reject(new Error('no json')),
    } as unknown as Response)
    const api = await request('/api/x').catch((cause: unknown) => cause) as ApiError
    expect(api.code).toBe('UNKNOWN_ERROR')
    expect(api.isUnauthorized).toBe(true)
  })
})

describe('error helpers', () => {
  it('reads an ApiError message, else a generic one', () => {
    expect(errorMessage(new ApiError(409, 'CONFLICT', 'Taken', null))).toBe('Taken')
    expect(errorMessage(new Error('x'))).toMatch(/could not be reached/i)
  })

  it('joins only the details not already shown by fields', () => {
    const error = new ApiError(422, 'VALIDATION_ERROR', 'fallback', [
      { path: 'email', message: 'bad email' },
      { path: 'spDc', message: 'bad key' },
    ])
    expect(refusalMessage(error, ['email'])).toBe('bad key')
    expect(refusalMessage(error, ['email', 'spDc'])).toBe('fallback')
    expect(refusalMessage(new Error('x'))).toMatch(/could not be reached/i)
  })

  it('recognises an abort', () => {
    expect(isAbort(new DOMException('a', 'AbortError'))).toBe(true)
    expect(isAbort(new Error('x'))).toBe(false)
  })
})

describe('endpoint helpers', () => {
  it('calls the right urls and methods', async () => {
    const fetchMock = spyFetch().mockResolvedValue(jsonResponse({}))
    await getCatalog()
    await createOrder({ plan: 'lifetime', country: 'US', email: 'a@b.c', spDc: 'x'.repeat(12), locale: 'en' })
    await getOrder('tok en')
    await lookupOrder({ reference: 'BMS-0000ABCD', email: 'a@b.c' })
    await submitSpotify('tok', 'cookie')
    const urls = fetchMock.mock.calls.map((call) => call[0])
    expect(urls[0]).toBe('/api/catalog')
    expect(urls[1]).toBe('/api/orders')
    expect(urls[2]).toBe('/api/orders/tok%20en')
    expect(urls[3]).toBe('/api/orders/lookup')
    expect(urls[4]).toBe('/api/orders/tok/spotify')
  })

  it('calls the admin urls and methods', async () => {
    const fetchMock = spyFetch().mockResolvedValue(jsonResponse({ orders: [], keys: [] }))
    await listAdminOrders({ status: 'failed', limit: 10 })
    await listAdminOrders({})
    await getAdminOrder('BMS-0000ABCD')
    await runAdminAction('BMS-0000ABCD', 'retry')
    await getKeyStats()
    await importKeys({ plan: 'lifetime', keys: 'K1' })
    const calls = fetchMock.mock.calls
    expect(calls[0][0]).toBe('/api/admin/orders?status=failed&limit=10')
    expect(calls[1][0]).toBe('/api/admin/orders')
    expect(calls[2][0]).toBe('/api/admin/orders/BMS-0000ABCD')
    expect(calls[3][0]).toBe('/api/admin/orders/BMS-0000ABCD/action')
    expect((calls[3][1] as RequestInit).body).toBe('{"action":"retry"}')
    expect(calls[4][0]).toBe('/api/admin/keys')
    expect((calls[5][1] as RequestInit).body).toBe('{"plan":"lifetime","keys":"K1"}')
  })

  it('calls the promo urls and methods', async () => {
    const fetchMock = spyFetch().mockResolvedValue(jsonResponse({ promos: [] }))
    await previewPromo('save25', 'lifetime')
    await listPromos()
    await createPromo({ code: 'X', kind: 'percent', value: 25 })
    await setPromoActive('p1', false)
    const calls = fetchMock.mock.calls
    expect(calls[0][0]).toBe('/api/promo')
    expect((calls[0][1] as RequestInit).body).toBe('{"code":"save25","plan":"lifetime"}')
    expect(calls[1][0]).toBe('/api/admin/promos')
    expect(calls[2][0]).toBe('/api/admin/promos')
    expect((calls[2][1] as RequestInit).method).toBe('POST')
    expect(calls[3][0]).toBe('/api/admin/promos/p1/active')
  })
})
