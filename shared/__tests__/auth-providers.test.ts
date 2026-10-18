import { describe, it, expect } from 'vitest'
import { SOCIAL_PROVIDER_IDS, isSocialProviderId } from '../auth-providers.js'

describe('auth providers', () => {
  it('knows google and nothing else', () => {
    expect([...SOCIAL_PROVIDER_IDS]).toEqual(['google'])
    expect(isSocialProviderId('google')).toBe(true)
    expect(isSocialProviderId('github')).toBe(false)
    expect(isSocialProviderId('facebook')).toBe(false)
    expect(isSocialProviderId(7)).toBe(false)
  })
})
