export const SOCIAL_PROVIDER_IDS = ['google', 'github'] as const

export type SocialProviderId = typeof SOCIAL_PROVIDER_IDS[number]

export const isSocialProviderId = (value: unknown): value is SocialProviderId =>
  typeof value === 'string' && (SOCIAL_PROVIDER_IDS as readonly string[]).includes(value)
