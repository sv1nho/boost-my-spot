import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fill, translate, useT, useLocale, LocaleProvider } from '../../i18n/context.js'
import { LanguageToggle } from '../../i18n/LanguageToggle.js'
import { preferredLocale } from '../../i18n/locale.js'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('translate and fill', () => {
  it('fills placeholders and falls back to the key', () => {
    expect(fill('Hello {name}', { name: 'Max' })).toBe('Hello Max')
    expect(fill('Hi {missing}', { other: 'x' })).toBe('Hi {missing}')
    expect(fill('Plain')).toBe('Plain')
    expect(translate('en', 'Order')).toBe('Order')
    expect(translate('fr', 'Order')).toBe('Commander')
    expect(translate('fr', 'Unknown phrase')).toBe('Unknown phrase')
  })
})

describe('useT outside a provider', () => {
  it('falls back to filling the English phrase', () => {
    const { result } = renderHook(() => useT())
    expect(result.current('Hello {name}', { name: 'Max' })).toBe('Hello Max')
  })

  it('exposes a no-op locale state', () => {
    const { result } = renderHook(() => useLocale())
    expect(result.current.locale).toBe('en')
    expect(() => { result.current.setLocale('fr') }).not.toThrow()
  })
})

describe('LocaleProvider with a blocked localStorage', () => {
  it('still reads and switches the language', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    })
    render(<LocaleProvider><LanguageToggle /></LocaleProvider>)
    const toggle = screen.getByRole('button')
    expect(toggle).toHaveTextContent('FR')
    await userEvent.click(toggle)
    expect(screen.getByRole('button')).toHaveTextContent('EN')
  })
})

describe('preferredLocale', () => {
  it('prefers the stored choice, then the browser languages', () => {
    expect(preferredLocale('fr', ['en-US'])).toBe('fr')
    expect(preferredLocale(null, ['fr-FR', 'en'])).toBe('fr')
    expect(preferredLocale(null, ['en-US'])).toBe('en')
    expect(preferredLocale('bogus', ['de'])).toBe('en')
  })
})
