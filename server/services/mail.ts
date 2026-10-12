type Deps = {
  fetch: typeof fetch
  baseUrl: string
  apiKey: string
  from: string
  timeoutMs?: number
}

type Mail = { to: string; subject: string; html: string; text?: string }

type Mailer = {
  send: (mail: Mail) => Promise<void>
}

const DEFAULT_TIMEOUT = 15_000

export function createMailer ({ fetch, baseUrl, apiKey, from, timeoutMs = DEFAULT_TIMEOUT }: Deps): Mailer {
  return {
    send: async ({ to, subject, html, text }) => {
      const response = await fetch(`${baseUrl}/emails`, {
        method: 'POST',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, subject, html, ...(text === undefined ? {} : { text }) }),
      })

      if (!response.ok) {
        throw new Error(`Resend refused the email: ${String(response.status)}`)
      }
    },
  }
}
