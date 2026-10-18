import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import express from 'express'
import request from 'supertest'
import { cacheBuiltFiles, createSecurityHeaders, createWebAppFallback } from '../../middleware/web-app.js'

let built = ''

beforeAll(() => {
  built = mkdtempSync(join(tmpdir(), 'shipbox-web-'))
  mkdirSync(join(built, 'assets'))
  writeFileSync(join(built, 'index.html'), '<!doctype html><title>ShipBox</title>')
  writeFileSync(join(built, 'assets', 'index-abc123.js'), 'console.log(1)')
})

afterAll(() => {
  rmSync(built, { recursive: true, force: true })
})

const served = (root = built) => {
  const app = express()

  app.use(express.static(root, { index: false, setHeaders: cacheBuiltFiles }))
  app.get('/api/thing', (_req, res) => { res.json({ ok: true }) })
  app.post('/api/thing', (_req, res) => { res.json({ ok: true }) })
  app.use(createWebAppFallback(root))
  app.use((_req, res) => { res.status(404).json({ error: 'nothing here' }) })

  return app
}

describe('serving the built front', () => {
  it('answers an unknown path with the page, so client routes work on a refresh', async () => {
    const response = await request(served()).get('/shipments').expect(200)

    expect(response.text).toContain('ShipBox')
  })

  it('leaves the api alone', async () => {
    await request(served()).get('/api/thing').expect(200, { ok: true })
  })

  it('leaves anything that is not a plain read alone', async () => {
    await request(served()).post('/api/thing').expect(200)
  })

  it('falls through when nothing was built, instead of answering a broken page', async () => {
    const response = await request(served(join(built, 'missing'))).get('/shipments').expect(404)

    expect(response.body).toEqual({ error: 'nothing here' })
  })
})

describe('how long the browser may keep a file', () => {
  it('keeps a hashed asset for a year, since its name changes when it changes', async () => {
    const response = await request(served()).get('/assets/index-abc123.js').expect(200)

    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable')
  })

  it('makes the page itself be checked every time', async () => {
    const response = await request(served()).get('/index.html').expect(200)

    expect(response.headers['cache-control']).toBe('no-cache')
  })
})

describe('the security headers', () => {
  const guarded = (overHttps: boolean) => {
    const app = express()

    app.use(createSecurityHeaders(overHttps))
    app.get('/', (_req, res) => { res.json({ ok: true }) })

    return app
  }

  it('says where scripts, styles and frames may come from', async () => {
    const response = await request(guarded(false)).get('/').expect(200)
    const policy = response.headers['content-security-policy']

    expect(policy).toContain("default-src 'self'")
    expect(policy).toContain("script-src 'self'")
    expect(policy).toContain("object-src 'none'")
    expect(policy).toContain("frame-ancestors 'none'")
    expect(policy).toContain('https://fonts.gstatic.com')
  })

  it('refuses to be framed and keeps the referrer at home', async () => {
    const response = await request(guarded(false)).get('/').expect(200)

    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(response.headers['referrer-policy']).toBe('same-origin')
  })

  it('asks for https only when it is served over https', async () => {
    expect((await request(guarded(true)).get('/')).headers['strict-transport-security'])
      .toContain('max-age=15552000')
    expect((await request(guarded(false)).get('/')).headers['strict-transport-security'])
      .toBeUndefined()
  })
})
