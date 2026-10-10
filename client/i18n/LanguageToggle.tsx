import { useLocale } from './context.js'
import { LOCALE_LABELS } from './locale.js'

export function LanguageToggle () {
  const { locale, setLocale, t } = useLocale()
  const other = locale === 'en' ? 'fr' : 'en'

  return (
    <button
      type='button'
      className='navbar-link language-toggle'
      aria-label={t('Read this site in {language}', { language: LOCALE_LABELS[other] })}
      title={t('Read this site in {language}', { language: LOCALE_LABELS[other] })}
      onClick={() => { setLocale(other) }}
    >
      {other.toUpperCase()}
    </button>
  )
}
