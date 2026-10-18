import { describe, it, expect } from 'vitest'
import { SOCIAL_PROVIDER_IDS, isSocialProviderId } from '../auth-providers.js'

describe('auth providers', () => {
  it('knows google and github', () => {
    expect([...SOCIAL_PROVIDER_IDS]).toEqual(['google', 'github'])
    expect(isSocialProviderId('google')).toBe(true)
    expect(isSocialProviderId('github')).toBe(true)
    expect(isSocialProviderId('facebook')).toBe(false)
    expect(isSocialProviderId(7)).toBe(false)
  })
})
