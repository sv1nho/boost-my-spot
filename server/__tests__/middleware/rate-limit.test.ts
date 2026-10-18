import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createApiLimiter } from '../../middleware/rate-limit.js'
import { bodyOf } from '../routes/http.js'

const appWith = (limit: number) => {
  const app = express()

  app.use('/api', createApiLimiter(limit))
  app.get('/api/thing', (_req, res) => { res.json({ ok: true }) })

  return app
}

describe('how many requests one caller may send', () => {
  it('lets the allowed ones through', async () => {
    const app = appWith(2)

    await request(app).get('/api/thing').expect(200)
    await request(app).get('/api/thing').expect(200)
  })

  it('refuses the next one with the same shape as any other refusal', async () => {
    const app = appWith(1)

    await request(app).get('/api/thing').expect(200)
    const response = await request(app).get('/api/thing').expect(429)

    expect(bodyOf(response)).toEqual({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests. Wait a moment before trying again.',
        details: null,
      },
    })
  })

  it('says it in the language the caller reads', async () => {
    const app = appWith(1)

    await request(app).get('/api/thing')
    const response = await request(app).get('/api/thing').set('Accept-Language', 'fr-BE').expect(429)

    expect(bodyOf<{ error: { message: string } }>(response).error.message).toBe('Trop de requêtes. Patientez un instant avant de réessayer.')
  })

  it('tells the caller when to come back, the standard way', async () => {
    const app = appWith(1)

    await request(app).get('/api/thing')
    const response = await request(app).get('/api/thing').expect(429)

    expect(response.headers['ratelimit-policy']).toContain('60')
  })
})
