import { test, expect } from '@playwright/test'

test('an admin creates a promo and a buyer redeems it for free', async ({ page, request }) => {
  const code = `FREE${Date.now()}`
  await request.post('/api/admin/keys', { data: { plan: 'lifetime', keys: `PROMO-KEY-${Date.now()}` } })

  await page.goto('/admin/promos')
  await page.getByLabel('Code').fill(code)
  await page.getByLabel('Percent (1–100)').fill('100')
  await page.getByRole('button', { name: 'Create a promo code' }).click()
  await expect(page.getByText(code)).toBeVisible()

  const email = `promo-${Date.now()}@boostmyspot.test`
  await page.goto('/order')
  await page.getByRole('heading', { name: 'Order your upgrade' }).waitFor()
  await page.getByLabel('Country').selectOption('US')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('Spotify session key').fill('valid-session-cookie')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByRole('checkbox', { name: 'I accept the terms of service.' }).check()
  await page.getByRole('checkbox', { name: 'I want my upgrade right away and waive my 14-day right of withdrawal.' }).check()
  await page.getByRole('button', { name: 'Continue' }).click()

  await page.getByLabel('Promo code').fill(code)
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.getByRole('button', { name: 'Get my free upgrade' })).toBeVisible()

  await page.getByRole('button', { name: 'Get my free upgrade' }).click()

  await expect(page.locator('.status-pill')).toHaveText('Premium active', { timeout: 30_000 })
})
