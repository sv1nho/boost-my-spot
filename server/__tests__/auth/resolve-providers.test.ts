import { describe, it, expect } from 'vitest'
import { resolveEnabledProviders } from '../../auth/resolve-providers.js'
import type { ProviderCredentials } from '../../auth/resolve-providers.js'

const credentials = (overrides: Partial<ProviderCredentials> = {}): ProviderCredentials => ({
  google: {},
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

  it.each([
    ['id without secret', { clientId: 'id' }],
    ['secret without id', { clientSecret: 'secret' }],
  ])('does not enable a provider with only an %s', (_label, pair) => {
    expect(resolveEnabledProviders(credentials({ google: pair }))).toEqual([])
  })
})
