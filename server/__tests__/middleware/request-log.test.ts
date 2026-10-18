import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextFunction, Request, Response } from 'express'

vi.mock('../../log.js', () => ({ log: vi.fn() }))

import { log } from '../../log.js'
import { requestLog } from '../../middleware/request-log.js'

type Finish = () => void

const call = (
  { given, status = 200, user }: { given?: string; status?: number; user?: string } = {}
) => {
  const finishers: Finish[] = []
  const headers: Record<string, unknown> = {}

  const req = {
    method: 'GET',
    originalUrl: '/api/shipments?page=2',
    get: () => given,
    user: user === undefined ? undefined : { id: user },
  } as unknown as Request

  const res = {
    statusCode: status,
    setHeader: (name: string, value: unknown) => { headers[name] = value },
    on: (event: string, listener: Finish) => { if (event === 'finish') finishers.push(listener) },
  } as unknown as Response

  const next: NextFunction = vi.fn()

  requestLog(req, res, next)

  return { req, headers, next, finish: () => { for (const done of finishers) done() } }
}

beforeEach(() => {
  vi.mocked(log).mockClear()
})

describe('the identifier it hands every request', () => {
  it('invents one when nothing upstream offered it', () => {
    const { req, headers } = call()

    expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(headers['x-request-id']).toBe(req.requestId)
  })

  it('keeps the one a proxy already set, so a trace survives the hop', () => {
    const { req } = call({ given: 'trace-from-the-proxy' })

    expect(req.requestId).toBe('trace-from-the-proxy')
  })

  it('refuses a header that would forge a second log line', () => {
    const { req } = call({ given: 'bad\ninjected line' })

    expect(req.requestId).not.toContain('injected')
    expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('lets the request through either way', () => {
    expect(call().next).toHaveBeenCalledOnce()
  })
})

describe('what it writes once the answer is out', () => {
  it('writes nothing until the response finishes', () => {
    call()

    expect(log).not.toHaveBeenCalled()
  })

  it('names the route without its query, and how long it took', () => {
    const { req, finish } = call({ user: 'user-1' })

    finish()

    expect(log).toHaveBeenCalledWith('info', 'request', expect.objectContaining({
      request: req.requestId,
      method: 'GET',
      path: '/api/shipments',
      status: 200,
      user: 'user-1',
    }))
  })

  it('counts the milliseconds it waited', () => {
    const { finish } = call()

    finish()

    const [, , fields] = vi.mocked(log).mock.calls[0]

    expect(fields?.ms).toBeTypeOf('number')
  })

  it('calls a server fault an error, so a host can alert on it', () => {
    const { finish } = call({ status: 503 })

    finish()

    expect(log).toHaveBeenCalledWith('error', 'request', expect.objectContaining({ status: 503 }))
  })

  it('leaves the user out when nobody was signed in', () => {
    const { finish } = call()

    finish()

    expect(log).toHaveBeenCalledWith('info', 'request', expect.objectContaining({ user: undefined }))
  })
})
