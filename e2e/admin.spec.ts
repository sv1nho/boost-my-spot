import { test, expect } from '@playwright/test'

test('an admin signs in and imports upgrade keys', async ({ page }) => {
  await page.goto('/admin')
  await expect(page.getByRole('link', { name: 'Keys' })).toBeVisible()

  await page.getByRole('link', { name: 'Keys' }).click()
  await page.getByRole('table').waitFor()

  const stamp = Date.now()
  await page.getByLabel('Keys').fill(`ADMIN-A-${stamp}\nADMIN-B-${stamp}`)
  await page.getByRole('button', { name: 'Import keys' }).click()
  await expect(page.getByText('Imported 2, skipped 0.')).toBeVisible()

  await page.getByLabel('Keys').fill(`ADMIN-A-${stamp}\nADMIN-C-${stamp}`)
  await page.getByRole('button', { name: 'Import keys' }).click()
  await expect(page.getByText('Imported 1, skipped 1.')).toBeVisible()
})
