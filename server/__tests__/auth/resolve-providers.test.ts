import { describe, it, expect } from 'vitest'
import { resolveEnabledProviders } from '../../auth/resolve-providers.js'
import type { ProviderCredentials } from '../../auth/resolve-providers.js'

const credentials = (overrides: Partial<ProviderCredentials> = {}): ProviderCredentials => ({
  google: {},
  github: {},
  ...overrides,
})

const complete = { clientId: 'id', clientSecret: 'secret' }

describe('resolveEnabledProviders', () => {
  it('enables nothing when no credentials are set', () => {
    expect(resolveEnabledProviders(credentials())).toEqual([])
  })

  it('enables a provider whose pair is complete', () => {
    expect(resolveEnabledProviders(credentials({ google: complete }))).toEqual(['google'])
  })

  it('enables every provider whose pair is complete', () => {
    expect(resolveEnabledProviders(credentials({ google: complete, github: complete })))
      .toEqual(['google', 'github'])
  })

  it.each([
    ['id without secret', { clientId: 'id' }],
    ['secret without id', { clientSecret: 'secret' }],
  ])('does not enable a provider with only an %s', (_label, pair) => {
    expect(resolveEnabledProviders(credentials({ google: pair }))).toEqual([])
  })

})
