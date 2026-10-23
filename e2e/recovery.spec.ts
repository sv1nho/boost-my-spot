import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const order = async (page: Page, spDc: string, email: string): Promise<void> => {
  await page.goto('/order')
  await page.getByRole('heading', { name: 'Order your upgrade' }).waitFor()
  await page.getByLabel('Country').selectOption('US')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('Spotify session key').fill(spDc)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByRole('checkbox', { name: 'I accept the terms of service.' }).check()
  await page.getByRole('checkbox', { name: 'I want my upgrade right away and waive my 14-day right of withdrawal.' }).check()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Pay securely' }).click()
}

test('a rejected cookie can be replaced from the tracking page', async ({ page, request }) => {
  const email = `recover-${Date.now()}@boostmyspot.test`

  const imported = await request.post('/api/admin/keys', {
    data: { plan: 'lifetime', keys: `RECOVER-KEY-${Date.now()}` },
  })
  expect(imported.ok(), await imported.text()).toBe(true)

  await order(page, 'invalid-session-cookie', email)

  await expect(page.locator('.status-pill')).toHaveText('Action needed', { timeout: 30_000 })

  await page.getByLabel('Spotify session key').fill('valid-session-cookie')
  await page.getByRole('button', { name: 'Submit the new key' }).click()

  await expect(page.locator('.status-pill')).toHaveText('Premium active', { timeout: 30_000 })
})
