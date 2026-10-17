import { describe, it, expect, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { LocaleProvider } from '../../i18n/context.js'
import { Help } from '../../pages/Help.js'
import { Terms } from '../../pages/Terms.js'
import { Privacy } from '../../pages/Privacy.js'

const renderIn = (locale: 'en' | 'fr', node: ReactNode) => {
  try { globalThis.localStorage.setItem('boostmyspot.locale', locale) } catch { /* ignore */ }
  return render(<LocaleProvider>{node}</LocaleProvider>)
}

afterEach(() => {
  try { globalThis.localStorage.clear() } catch { /* ignore */ }
})

describe('static pages', () => {
  it('shows Help in both languages', () => {
    const en = renderIn('en', <Help />)
    expect(en.getByText('Help & FAQ')).toBeInTheDocument()
    en.unmount()
    expect(renderIn('fr', <Help />).getByText('Aide et FAQ')).toBeInTheDocument()
  })

  it('shows the Terms in both languages', () => {
    const en = renderIn('en', <Terms />)
    expect(en.getByText('Terms of Service')).toBeInTheDocument()
    en.unmount()
    expect(renderIn('fr', <Terms />).getByText('Conditions d’utilisation')).toBeInTheDocument()
  })

  it('shows the Privacy page in both languages', () => {
    const en = renderIn('en', <Privacy />)
    expect(en.getByText('Privacy')).toBeInTheDocument()
    en.unmount()
    expect(renderIn('fr', <Privacy />).getByText('Confidentialité')).toBeInTheDocument()
  })
})
