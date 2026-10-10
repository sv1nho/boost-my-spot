import { FRENCH } from './fr.js'

const LOCALES = ['en', 'fr'] as const

export type Locale = typeof LOCALES[number]

export type Vars = Record<string, string | number>

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value)

export function localeOf (header: string | undefined): Locale {
  const wanted = (header ?? '')
    .split(',')
    .map((part) => part.split(';')[0].trim().toLowerCase())
    .find((tag) => tag.startsWith('fr') || tag.startsWith('en'))

  return wanted?.startsWith('fr') === true ? 'fr' : 'en'
}

const say = (locale: Locale, phrase: string): string =>
  locale === 'en' ? phrase : FRENCH[phrase] ?? phrase

export function translate (locale: Locale, phrase: string, vars?: Vars): string {
  const said = say(locale, phrase)

  if (vars === undefined) return said

  return said.replace(/\{(\w+)\}/g, (whole, name: string) => {
    if (!(name in vars)) return whole

    const value = vars[name]
    return typeof value === 'string' ? say(locale, value) : String(value)
  })
}
