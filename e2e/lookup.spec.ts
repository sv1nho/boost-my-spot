import { test, expect } from '@playwright/test'

test('a buyer finds their order by number and email', async ({ page, request }) => {
  const email = `lookup-${Date.now()}@boostmyspot.test`

  const created = await request.post('/api/orders', {
    data: { plan: 'lifetime', country: 'US', email, spDc: 'valid-session-cookie', locale: 'en' },
  })
  expect(created.ok(), await created.text()).toBe(true)
  const { token } = await created.json() as { token: string }

  const view = await request.get(`/api/orders/${encodeURIComponent(token)}`)
  const { reference } = await view.json() as { reference: string }

  await page.goto('/track')
  await page.getByLabel('Order number').fill(reference)
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Find my order' }).click()

  await expect(page.getByText(reference)).toBeVisible()
  await expect(page.locator('.status-pill')).toBeVisible()

  await page.getByRole('button', { name: 'Copy' }).click()
  await expect(page.getByText('Order number copied.')).toBeVisible()
})
