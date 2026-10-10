import { SOCIAL_PROVIDER_IDS } from '../../shared/auth-providers.js'
import type { SocialProviderId } from '../../shared/auth-providers.js'

type ProviderCredential = {
  clientId?: string
  clientSecret?: string
}

export type ProviderCredentials = Record<SocialProviderId, ProviderCredential>

export function resolveEnabledProviders (credentials: ProviderCredentials): SocialProviderId[] {
  return SOCIAL_PROVIDER_IDS.filter((id) => {
    const pair = credentials[id]
    return pair.clientId !== undefined && pair.clientSecret !== undefined
  })
}
