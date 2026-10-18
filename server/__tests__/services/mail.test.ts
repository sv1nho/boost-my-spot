import { describe, it, expect } from 'vitest'
import { createMailer } from '../../services/mail.js'

const makeFetch = (status: number) => {
  const calls: { url: string; init: RequestInit }[] = []
  const fn = ((url: string, init: RequestInit = {}) => {
    calls.push({ url, init })
    return Promise.resolve({ status, ok: status < 400 } as unknown as Response)
  }) as unknown as typeof fetch
  return { fn, calls }
}

describe('mailer', () => {
  it('posts the email to resend with the from address and bearer token', async () => {
    const { fn, calls } = makeFetch(200)
    const mailer = createMailer({ fetch: fn, baseUrl: 'https://resend.test', apiKey: 'K', from: 'me@b.test' })
    await mailer.send({ to: 'you@b.test', subject: 'Hi', html: '<p>Hi</p>' })
    expect(calls[0].url).toBe('https://resend.test/emails')
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer K')
    expect(JSON.parse(calls[0].init.body as string)).toMatchObject({
      from: 'me@b.test', to: 'you@b.test', subject: 'Hi', html: '<p>Hi</p>',
    })
  })

  it('includes the text body when given', async () => {
    const { fn, calls } = makeFetch(200)
    const mailer = createMailer({ fetch: fn, baseUrl: 'https://resend.test', apiKey: 'K', from: 'me@b.test' })
    await mailer.send({ to: 'you@b.test', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' })
    expect(JSON.parse(calls[0].init.body as string)).toMatchObject({ text: 'Hi' })
  })

  it('throws when resend refuses', async () => {
    const { fn } = makeFetch(422)
    const mailer = createMailer({ fetch: fn, baseUrl: 'https://resend.test', apiKey: 'K', from: 'me@b.test' })
    await expect(mailer.send({ to: 'x@b.test', subject: 's', html: 'h' })).rejects.toThrow()
  })
})
