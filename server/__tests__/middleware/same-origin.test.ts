import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createOriginGuard } from '../../middleware/same-origin.js'
import { createErrorHandler } from '../../middleware/error-handler.js'
import { bodyOf } from '../routes/http.js'

const APP_ORIGIN = 'https://shipbox.example'

const guarded = () => {
  const app = express()

  app.use(createOriginGuard(APP_ORIGIN))
  app.get('/api/thing', (_req, res) => { res.json({ read: true }) })
  app.post('/api/thing', (_req, res) => { res.json({ written: true }) })
  app.use(createErrorHandler({ exposeDetails: true, logRefusals: false }))

  return app
}

describe('a write that claims to come from somewhere else', () => {
  it('is refused, whatever the session says', async () => {
    const response = await request(guarded())
      .post('/api/thing')
      .set('Origin', 'https://evil.example')
      .expect(403)

    expect(bodyOf<{ error: { code: string } }>(response).error.code).toBe('FORBIDDEN')
  })

  it('goes through when it comes from the app itself', async () => {
    await request(guarded()).post('/api/thing').set('Origin', APP_ORIGIN).expect(200, { written: true })
  })

  it('goes through when no browser is involved, since none sets the header', async () => {
    await request(guarded()).post('/api/thing').expect(200, { written: true })
  })
})

describe('a read', () => {
  it('is never refused for its origin, it changes nothing', async () => {
    await request(guarded())
      .get('/api/thing')
      .set('Origin', 'https://evil.example')
      .expect(200, { read: true })
  })
})
