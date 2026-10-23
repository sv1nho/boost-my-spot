import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'

const STANDARDS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

const audit = async (page: Page): Promise<string[]> => {
  const { violations } = await new AxeBuilder({ page }).withTags(STANDARDS).analyze()
  return violations.map((violation) => `${violation.id}: ${violation.help}`)
}

const PUBLIC_PAGES = [
  ['the home page', '/', 'Spotify Premium, upgraded for you'],
  ['the order form', '/order', 'Order your upgrade'],
  ['the tracking lookup', '/track', 'Track your order'],
  ['the help page', '/help', 'Help & FAQ'],
  ['the terms page', '/terms', 'Terms of Service'],
  ['the privacy page', '/privacy', 'We collect only what the order needs'],
] as const

for (const [what, path, waitFor] of PUBLIC_PAGES) {
  test(`${what} meets the accessibility standards`, async ({ page }) => {
    await page.goto(path)
    await page.getByText(waitFor).first().waitFor()
    expect(await audit(page)).toEqual([])
  })
}

test('the admin orders and keys pages meet them', async ({ page }) => {
  await page.goto('/admin')
  await page.getByLabel('Filter by status').waitFor()
  expect(await audit(page)).toEqual([])

  await page.goto('/admin/keys')
  await page.getByRole('table').waitFor()
  expect(await audit(page)).toEqual([])

  await page.goto('/admin/promos')
  await page.getByRole('button', { name: 'Create a promo code' }).waitFor()
  expect(await audit(page)).toEqual([])
})

test('the sign-in page meets them', async ({ browser }) => {
  const context = await browser.newContext({ storageState: undefined })
  const page = await context.newPage()
  await page.goto('/login')
  await page.getByText('Back-office sign in').waitFor()
  expect(await audit(page)).toEqual([])
  await context.close()
})

test('the tracking and admin detail pages meet them', async ({ page, request }) => {
  const email = `a11y-${Date.now()}@boostmyspot.test`
  const created = await request.post('/api/orders', {
    data: { plan: 'lifetime', country: 'US', email, spDc: 'valid-session-cookie', locale: 'en' },
  })
  const { token } = await created.json() as { token: string }
  const { reference } = await (await request.get(`/api/orders/${encodeURIComponent(token)}`)).json() as { reference: string }

  await page.goto(`/orders/${token}`)
  await page.locator('.status-pill').waitFor()
  expect(await audit(page)).toEqual([])

  await page.goto(`/admin/orders/${reference}`)
  await page.getByRole('heading', { name: reference }).waitFor()
  expect(await audit(page)).toEqual([])
})
