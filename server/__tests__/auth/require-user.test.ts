import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextFunction, Request, Response } from 'express'

const getSession = vi.fn()

vi.mock('../../auth/auth.js', () => ({
  auth: { api: { getSession } },
}))

const { requireUser, currentUser } = await import('../../auth/require-user.js')
const { AppError } = await import('../../errors.js')

const fakeRequest = (headers: Record<string, string> = {}) =>
  ({ headers }) as unknown as Request

const run = async (req: Request) => {
  const next = vi.fn()
  requireUser(req, {} as Response, next as NextFunction)
  await vi.waitFor(() => { expect(next).toHaveBeenCalled() })
  return next
}

const session = {
  user: {
    id: 'user-1',
    email: 'someone@example.com',
    name: 'Someone',
    image: 'https://avatar.example/a.png',
  },
}

beforeEach(() => {
  getSession.mockReset()
})

describe('requireUser', () => {
  it('rejects a request without a session with 401', async () => {
    getSession.mockResolvedValue(null)
    const req = fakeRequest()

    const next = await run(req)

    const forwarded: unknown = next.mock.calls[0][0]
    expect(forwarded).toBeInstanceOf(AppError)
    expect((forwarded as InstanceType<typeof AppError>).status).toBe(401)
    expect(req.user).toBeUndefined()
  })

  it('attaches the session user and continues', async () => {
    getSession.mockResolvedValue(session)
    const req = fakeRequest()

    const next = await run(req)

    expect(next).toHaveBeenCalledWith()
    expect(req.user).toEqual({
      id: 'user-1',
      email: 'someone@example.com',
      name: 'Someone',
      image: 'https://avatar.example/a.png',
    })
  })

  it('normalises a missing avatar to null rather than undefined', async () => {
    getSession.mockResolvedValue({ user: { ...session.user, image: null } })
    const req = fakeRequest()

    await run(req)

    expect(req.user?.image).toBeNull()
  })

  it('forwards an unexpected failure instead of granting access', async () => {
    const failure = new Error('database unreachable')
    getSession.mockRejectedValue(failure)
    const req = fakeRequest()

    const next = await run(req)

    expect(next).toHaveBeenCalledWith(failure)
    expect(req.user).toBeUndefined()
  })

  it('passes the incoming headers on, so the session cookie is read', async () => {
    getSession.mockResolvedValue(session)

    await run(fakeRequest({ cookie: 'shipbox.session_token=abc' }))

    const passed = getSession.mock.calls[0][0] as { headers: Headers }
    expect(passed.headers.get('cookie')).toBe('shipbox.session_token=abc')
  })
})

describe('currentUser', () => {
  it('returns the user attached by the middleware', () => {
    const req = fakeRequest()
    req.user = { id: 'user-1', email: 'a@b.c', name: 'A', image: null }

    expect(currentUser(req)).toEqual(req.user)
  })

  it('throws rather than returning undefined when the middleware did not run', () => {
    expect(() => currentUser(fakeRequest())).toThrow(AppError)
  })
})
