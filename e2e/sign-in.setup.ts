import { mkdirSync } from 'node:fs'
import { test as setup, expect } from '@playwright/test'

const STATE = 'e2e/.auth/state.json'

export const SIGNED_IN = {
  name: 'Browser Test',
  email: 'browser-test@boostmyspot.test',
  password: 'a-password-only-the-browser-tests-use',
}

setup('signs one account in and keeps its cookies', async ({ request }) => {
  const created = await request.post('/api/auth/sign-up/email', { data: SIGNED_IN })

  expect(created.ok(), await created.text()).toBe(true)

  const session = await request.get('/api/auth/get-session')

  expect(await session.json()).toMatchObject({ user: { email: SIGNED_IN.email } })

  mkdirSync('e2e/.auth', { recursive: true })
  await request.storageState({ path: STATE })
})
