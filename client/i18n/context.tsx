import { createContext, use, useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { askInLocale } from '../api/client.js'
import { FRENCH } from './fr.js'
import { STORAGE_KEY, preferredLocale } from './locale.js'
import type { Locale } from './locale.js'

export type Vars = Record<string, string | number>

export type Translate = (phrase: string, vars?: Vars) => string

type LocaleState = {
  locale: Locale
  setLocale: (next: Locale) => void
  t: Translate
}

const read = (): string | null => {
  try {
    return globalThis.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

const remember = (locale: Locale): void => {
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    return
  }
}

export const fill = (phrase: string, vars?: Vars): string =>
  vars === undefined
    ? phrase
    : phrase.replace(/\{(\w+)\}/g, (whole, name: string) =>
        name in vars ? String(vars[name]) : whole)

export const translate = (locale: Locale, phrase: string, vars?: Vars): string =>
  fill(locale === 'en' ? phrase : FRENCH[phrase] ?? phrase, vars)

const LocaleContext = createContext<LocaleState | null>(null)

export function LocaleProvider ({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Locale>(() => {
    const chosen = preferredLocale(read(), navigator.languages)
    askInLocale(chosen)
    return chosen
  })

  const setLocale = useCallback((next: Locale) => {
    remember(next)
    askInLocale(next)
    setCurrent(next)
    document.documentElement.lang = next
  }, [])

  const value = useMemo<LocaleState>(() => ({
    locale: current,
    setLocale,
    t: (phrase, vars) => translate(current, phrase, vars),
  }), [current, setLocale])

  return <LocaleContext value={value}>{children}</LocaleContext>
}

export function useLocale (): LocaleState {
  const state = use(LocaleContext)

  return state ?? { locale: 'en', setLocale: () => {}, t: fill }
}

export function useT (): Translate {
  return useLocale().t
}

