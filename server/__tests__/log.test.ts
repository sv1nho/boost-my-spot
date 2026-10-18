import { describe, it, expect, vi, afterEach } from 'vitest'

const stubMode = (mode: string): void => {
  vi.stubEnv('NODE_ENV', mode)
  vi.stubEnv('WEB_ORIGIN', 'https://boostmyspot.example')
  vi.stubEnv('BETTER_AUTH_URL', 'https://boostmyspot.example')
  vi.stubEnv('GOOGLE_CLIENT_ID', 'id-for-the-test')
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'secret-for-the-test')
  vi.stubEnv('SECRET_BOX_KEY', '0'.repeat(64))
  vi.stubEnv('ORDER_LINK_SECRET', 'order-link-secret-at-least-32-chars-long')
  vi.stubEnv('UPGRADER_API_URL', 'https://upgrader.example')
  vi.stubEnv('UPGRADER_API_KEY', 'k')
  vi.stubEnv('NOWPAYMENTS_API_URL', 'https://nowpayments.example')
  vi.stubEnv('NOWPAYMENTS_API_KEY', 'k')
  vi.stubEnv('NOWPAYMENTS_IPN_SECRET', 'k')
  vi.stubEnv('RESEND_API_URL', 'https://resend.example')
  vi.stubEnv('RESEND_API_KEY', 'k')
  vi.stubEnv('MAIL_FROM', 'orders@boostmyspot.example')
  vi.stubEnv('ADMIN_EMAILS', 'admin@boostmyspot.example')
}

const written = async (mode: string, write: () => Promise<void>): Promise<string[]> => {
  vi.resetModules()
  stubMode(mode)

  const lines: string[] = []
  const take = (chunk: unknown): boolean => {
    lines.push(String(chunk))
    return true
  }

  vi.spyOn(process.stdout, 'write').mockImplementation(take)
  vi.spyOn(process.stderr, 'write').mockImplementation(take)

  await write()

  return lines
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('in development', () => {
  it('writes a line a person can read at a glance', async () => {
    const [line] = await written('development', async () => {
      const { log } = await import('../log.js')
      log('info', 'listening', { port: 3000, mode: 'development' })
    })

    expect(line).toBe('INFO listening port=3000 mode=development\n')
  })

  it('leaves out a field that carries nothing, rather than printing undefined', async () => {
    const [line] = await written('development', async () => {
      const { log } = await import('../log.js')
      log('warn', 'refused', { request: undefined, user: null, status: 404 })
    })

    expect(line).toBe('WARN refused status=404\n')
  })

  it('needs no fields at all', async () => {
    const [line] = await written('development', async () => {
      const { log } = await import('../log.js')
      log('info', 'shutting down')
    })

    expect(line).toBe('INFO shutting down\n')
  })
})

describe('in production', () => {
  it('writes one json object per line, which a host can index', async () => {
    const [line] = await written('production', async () => {
      const { log } = await import('../log.js')
      log('info', 'request', { status: 200 })
    })

    expect(JSON.parse(line) as Record<string, unknown>).toMatchObject({
      level: 'info',
      message: 'request',
      status: 200,
    })
    expect(new Date(String((JSON.parse(line) as { time: string }).time)).getTime()).not.toBeNaN()
  })
})

describe('where each level goes', () => {
  it('sends an error to stderr, so a host can separate it from the rest', async () => {
    vi.resetModules()
    stubMode('development')

    const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    const { log } = await import('../log.js')

    log('error', 'failed')

    expect(err).toHaveBeenCalledOnce()
    expect(out).not.toHaveBeenCalled()
  })
})
