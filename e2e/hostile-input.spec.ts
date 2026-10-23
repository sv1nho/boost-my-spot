import { test, expect } from '@playwright/test'

const HOSTILE = [
  '<script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>',
  "'; DROP TABLE orders; --",
  '{{7*7}}',
  '../../etc/passwd',
  'a'.repeat(3000),
  '𝕏'.repeat(200),
  'line\nbreak\ttab',
  '%00%0d%0a',
  '&amp;&lt;&gt;&quot;',
]

test.describe('what the forms do with hostile text', () => {
  test.skip(process.env.FUZZ_UI !== 'true', 'Run with FUZZ_UI=true to throw text at the forms')

  for (const [index, text] of HOSTILE.entries()) {
    test(`the order form survives payload ${String(index + 1)}`, async ({ page }) => {
      const broken: string[] = []
      page.on('pageerror', (error) => broken.push(error.message))

      await page.goto('/order')
      await page.getByRole('button', { name: 'Continue' }).click()
      await page.getByLabel('Spotify session key').fill(text)
      await page.getByRole('button', { name: 'Continue' }).click()

      await expect(page.getByRole('heading', { name: 'Order your upgrade' })).toBeVisible()
      expect(broken).toEqual([])
    })

    test(`the tracking lookup survives payload ${String(index + 1)}`, async ({ page }) => {
      const broken: string[] = []
      page.on('pageerror', (error) => broken.push(error.message))

      await page.goto('/track')
      await page.getByLabel('Order number').fill(text)
      await page.getByLabel('Email').fill(text)
      await page.getByRole('button', { name: 'Find my order' }).click()

      await expect(page.getByRole('button', { name: 'Find my order' })).toBeVisible()
      expect(broken).toEqual([])
    })

    test(`a crafted tracking link survives payload ${String(index + 1)}`, async ({ page }) => {
      const broken: string[] = []
      page.on('pageerror', (error) => broken.push(error.message))

      await page.goto(`/orders/${encodeURIComponent(text)}`)
      await expect(page.locator('.site-footer')).toBeVisible()
      expect(broken).toEqual([])
    })
  }
})
