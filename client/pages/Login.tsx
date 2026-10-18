import { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { isAbort } from '../api/client.js'
import { signIn, useSession } from '../auth/client.js'
import { SOCIAL_PROVIDERS } from '../auth/providers.js'
import { isSocialProviderId } from '../../shared/auth-providers.js'
import type { SocialProviderId } from '../../shared/auth-providers.js'
import { PendingNote } from '../components/PendingNote.js'
import { Spinner } from '../components/Spinner.js'
import { useT } from '../i18n/context.js'

const DEFAULT_REDIRECT = '/admin'

export function Login () {
  const { data: session, isPending } = useSession()
  const [searchParams] = useSearchParams()
  const [providers, setProviders] = useState<SocialProviderId[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingProvider, setPendingProvider] = useState<SocialProviderId | null>(null)
  const t = useT()

  const redirectTo = searchParams.get('redirect') ?? DEFAULT_REDIRECT

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/config', { signal: controller.signal })
      .then((response) => response.json())
      .then((body: { providers?: unknown }) => {
        setProviders(Array.isArray(body.providers) ? body.providers.filter(isSocialProviderId) : [])
      })
      .catch((cause: unknown) => {
        if (isAbort(cause)) return
        setProviders([])
      })

    return () => { controller.abort() }
  }, [])

  if (isPending) {
    return <PendingNote label={t('Checking your session…')} />
  }

  if (session !== null) {
    return <Navigate to={redirectTo} replace />
  }

  const handleSignIn = async (provider: SocialProviderId): Promise<void> => {
    setError(null)
    setPendingProvider(provider)

    const result = await signIn.social({
      provider,
      callbackURL: redirectTo,
      errorCallbackURL: '/login?error=oauth',
    })

    if (result.error) {
      setPendingProvider(null)
      setError(result.error.message ?? t('Sign-in failed, please try again.'))
    }
  }

  return (
    <div className='auth-page'>
      <div className='auth-card'>
        <h1 className='auth-title'>{t('Back-office sign in')}</h1>
        <p className='auth-text'>{t('Sign in to manage orders and upgrade keys.')}</p>

        {searchParams.get('error') === 'oauth' && (
          <div className='alert-error'>{t('Sign-in was cancelled or refused. You can try again.')}</div>
        )}

        {error !== null && <div className='alert-error'>{error}</div>}

        {providers === null && <PendingNote label={t('Loading sign-in options…')} />}

        {providers !== null && providers.length === 0 && (
          <div className='alert-error'>{t('No sign-in provider is configured on this server.')}</div>
        )}

        {providers?.map((provider) => (
          <button
            key={provider}
            type='button'
            className='btn btn-social'
            disabled={pendingProvider !== null}
            onClick={() => { void handleSignIn(provider) }}
          >
            {pendingProvider === provider
              ? (<><Spinner />{t('Redirecting…')}</>)
              : (<>{SOCIAL_PROVIDERS[provider].icon}{t(SOCIAL_PROVIDERS[provider].label)}</>)}
          </button>
        ))}

        <p className='auth-note'>
          {t('Only approved admin emails can sign in. No password is ever stored.')}
        </p>
      </div>
    </div>
  )
}
