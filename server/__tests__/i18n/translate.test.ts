import { describe, it, expect } from 'vitest'
import { translate, localeOf, isLocale } from '../../i18n/translate.js'
import { FRENCH } from '../../i18n/fr.js'

describe('localeOf', () => {
  it('reads the first understood tag, defaulting to English', () => {
    expect(localeOf('fr-BE,fr;q=0.9,en;q=0.8')).toBe('fr')
    expect(localeOf('en-US,en')).toBe('en')
    expect(localeOf('de-DE')).toBe('en')
    expect(localeOf(undefined)).toBe('en')
  })
})

describe('isLocale', () => {
  it('accepts the known locales and nothing else', () => {
    expect(isLocale('fr')).toBe(true)
    expect(isLocale('en')).toBe(true)
    expect(isLocale('de')).toBe(false)
    expect(isLocale(7)).toBe(false)
  })
})

describe('translate', () => {
  it('leaves English as the key', () => {
    expect(translate('en', 'Authentication required.')).toBe('Authentication required.')
  })

  it('looks the phrase up in French', () => {
    expect(translate('fr', 'Authentication required.')).toBe('Authentification requise.')
  })

  it('falls back to the key when French has never heard of it', () => {
    expect(translate('fr', 'A phrase not in the catalogue')).toBe('A phrase not in the catalogue')
  })

  it('fills placeholders and leaves an unknown one as is', () => {
    expect(translate('en', 'Hello {name}', { name: 'Max' })).toBe('Hello Max')
    expect(translate('en', 'Hello {name}', { other: 'x' })).toBe('Hello {name}')
  })

  it('translates a string value too, and passes a number through', () => {
    expect(translate('fr', 'Problem: {why}', { why: 'Authentication required.' }))
      .toBe('Problem: Authentification requise.')
    expect(translate('en', '{count} left', { count: 7 })).toBe('7 left')
  })
})

describe('the French catalogue', () => {
  it('never translates to empty text and keeps every placeholder', () => {
    for (const [english, french] of Object.entries(FRENCH)) {
      expect(french.trim()).not.toBe('')
      const placeholders = (phrase: string): string[] => (phrase.match(/\{\w+\}/g) ?? []).sort()
      expect(placeholders(french)).toEqual(placeholders(english))
    }
  })
})
