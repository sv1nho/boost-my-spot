import { test, expect } from '@playwright/test'

const FAKE = 'http://127.0.0.1:3199'

test('a guest orders an upgrade and watches it go active', async ({ page, request }) => {
  const email = `buyer-${Date.now()}@boostmyspot.test`

  const imported = await request.post('/api/admin/keys', {
    data: { plan: 'lifetime', keys: `PURCHASE-KEY-${Date.now()}` },
  })
  expect(imported.ok(), await imported.text()).toBe(true)

  await page.goto('/order')
  await page.getByRole('heading', { name: 'Order your upgrade' }).waitFor()

  await page.getByLabel('Country').selectOption('US')
  await page.getByLabel('Spotify session key').fill('valid-session-cookie')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('checkbox', { name: 'I accept the terms of service.' }).check()
  await page.getByRole('checkbox', { name: 'I want my upgrade right away and waive my 14-day right of withdrawal.' }).check()
  await page.getByRole('button', { name: 'Pay with crypto' }).click()

  await expect(page.locator('.status-pill')).toHaveText('Premium active', { timeout: 30_000 })

  const subjects = async (): Promise<string> => {
    const sent = await request.get(`${FAKE}/resend/sent?to=${encodeURIComponent(email)}`)
    const body = await sent.json() as { emails: { subject: string }[] }
    return body.emails.map((one) => one.subject).join(' ')
  }

  await expect.poll(subjects, { timeout: 30_000 }).toMatch(/active/i)
  expect(await subjects()).toMatch(/received/i)
})
