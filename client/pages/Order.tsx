import { useEffect, useState } from 'react'
import { Field, fieldMarks } from '../components/Field.js'
import { PendingNote } from '../components/PendingNote.js'
import { SpotifyKeyField } from '../orders/SpotifyKeyField.js'
import { getCatalog } from '../api/catalog.js'
import { createOrder } from '../api/orders.js'
import { ApiError, errorMessage, isAbort, refusalMessage } from '../api/client.js'
import { useLocale, useT } from '../i18n/context.js'
import type { Catalog } from '../../shared/order.js'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Draft = { country: string; email: string; spDc: string; terms: boolean; waiver: boolean }

type Problems = { email?: string; spDc?: string; terms?: string; waiver?: string }

const money = (cents: number): string => `€${(cents / 100).toFixed(2)}`

export function Order () {
  const t = useT()
  const { locale } = useLocale()

  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  const [draft, setDraft] = useState<Draft>({ country: 'ANY', email: '', spDc: '', terms: false, waiver: false })
  const [attempted, setAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [apiError, setApiError] = useState<ApiError | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getCatalog(controller.signal)
      .then((found) => { setCatalog(found); setLoadError(null) })
      .catch((cause: unknown) => {
        if (!isAbort(cause)) setLoadError(errorMessage(cause))
      })
    return () => { controller.abort() }
  }, [reload])

  if (loadError !== null) {
    return (
      <div className='card'>
        <div className='alert-error'>{loadError}</div>
        <button type='button' className='link-button' onClick={() => { setLoadError(null); setReload((n) => n + 1) }}>
          {t('Try again')}
        </button>
      </div>
    )
  }

  if (catalog === null) return <PendingNote label={t('Loading the offer…')} />

  const plan = catalog.plans[0]
  const countries = ['ANY', ...catalog.countries]

  const problems: Problems = {
    email: EMAIL.test(draft.email) ? undefined : t('Enter a valid email address.'),
    spDc: draft.spDc.trim().length >= 10 ? undefined : t('Paste your Spotify session key.'),
    terms: draft.terms ? undefined : t('Please accept the terms to continue.'),
    waiver: draft.waiver ? undefined : t('Please confirm you want your upgrade right away.'),
  }
  const shown = (key: keyof Problems): string | undefined =>
    attempted ? problems[key] ?? apiError?.messageFor(key) : undefined

  const submit = (): void => {
    setAttempted(true)
    setActionError(null)
    setApiError(null)
    if (Object.values(problems).some((problem) => problem !== undefined)) return

    setSubmitting(true)
    createOrder({ plan: plan.id, country: draft.country, email: draft.email, spDc: draft.spDc, locale })
      .then((created) => { window.location.assign(created.paymentUrl) })
      .catch((cause: unknown) => {
        if (cause instanceof ApiError) setApiError(cause)
        setActionError(refusalMessage(cause, ['email', 'spDc']))
        setSubmitting(false)
      })
  }

  return (
    <div className='card space-y-6'>
      <div className='card-header'>
        <h3 className='card-title'>{t('Order your upgrade')}</h3>
      </div>

      <div className='offer'>
        <span className='offer-name'>{t(plan.label)}</span>
        <span className='offer-price'>{money(plan.priceCents)}</span>
      </div>

      <form
        className='space-y-4'
        onSubmit={(event) => { event.preventDefault(); submit() }}
        noValidate
      >
        <Field label={t('Country')} htmlFor='order-country' problem={undefined} hint={t('Pick a country, or let us choose any available one.')}>
          <select
            id='order-country'
            className='form-select'
            value={draft.country}
            onChange={(event) => { setDraft((d) => ({ ...d, country: event.target.value })) }}
          >
            {countries.map((code) => (
              <option key={code} value={code}>{code === 'ANY' ? t('Any available country') : code}</option>
            ))}
          </select>
        </Field>

        <SpotifyKeyField
          id='order-spdc'
          value={draft.spDc}
          problem={shown('spDc')}
          onChange={(value) => { setDraft((d) => ({ ...d, spDc: value })) }}
        />

        <Field label={t('Email')} htmlFor='order-email' problem={shown('email')} hint={t('We send your order number and updates here.')}>
          <input
            {...fieldMarks('order-email', shown('email'), 'order-email-hint')}
            id='order-email'
            type='email'
            autoComplete='email'
            value={draft.email}
            onChange={(event) => { setDraft((d) => ({ ...d, email: event.target.value })) }}
          />
        </Field>

        <label className='form-check'>
          <input
            type='checkbox'
            checked={draft.terms}
            onChange={(event) => { setDraft((d) => ({ ...d, terms: event.target.checked })) }}
          />
          {t('I accept the terms of service.')}
        </label>
        {shown('terms') !== undefined && <p className='field-error'>{shown('terms')}</p>}

        <label className='form-check'>
          <input
            type='checkbox'
            checked={draft.waiver}
            onChange={(event) => { setDraft((d) => ({ ...d, waiver: event.target.checked })) }}
          />
          {t('I want my upgrade right away and waive my 14-day right of withdrawal.')}
        </label>
        {shown('waiver') !== undefined && <p className='field-error'>{shown('waiver')}</p>}

        {actionError !== null && <div className='alert-error'>{actionError}</div>}

        <div className='form-actions'>
          <button type='submit' className='btn btn-primary' disabled={submitting}>
            {submitting ? t('Starting…') : t('Pay with crypto')}
          </button>
        </div>
      </form>
    </div>
  )
}
