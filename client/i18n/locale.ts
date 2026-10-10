const LOCALES = ['en', 'fr'] as const

export type Locale = typeof LOCALES[number]

export const STORAGE_KEY = 'boostmyspot.locale'

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value)

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
}

export function preferredLocale (stored: string | null, languages: readonly string[]): Locale {
  if (isLocale(stored)) return stored

  return languages.some((language) => language.toLowerCase().startsWith('fr')) ? 'fr' : 'en'
}
