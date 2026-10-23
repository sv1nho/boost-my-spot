import { useEffect, useState } from 'react'
import { Field, fieldMarks } from '../components/Field.js'
import { PendingNote } from '../components/PendingNote.js'
import { SpotifyKeyField } from '../orders/SpotifyKeyField.js'
import { SpotifyKeyGuide } from '../orders/SpotifyKeyGuide.js'
import { getCatalog } from '../api/catalog.js'
import { createOrder } from '../api/orders.js'
import { errorMessage, isAbort, refusalMessage } from '../api/client.js'
import { useLocale, useT } from '../i18n/context.js'
import type { Catalog } from '../../shared/order.js'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Draft = { country: string; email: string; spDc: string; terms: boolean; waiver: boolean }
type Problems = { email?: string; spDc?: string; terms?: string; waiver?: string }

const money = (cents: number): string => `€${(cents / 100).toFixed(2)}`

const STEP_LABELS = ['Offer', 'Spotify', 'Details', 'Payment'] as const
const STEP_FIELDS: (keyof Problems)[][] = [[], ['spDc'], ['email', 'terms', 'waiver'], []]
const LAST_STEP = STEP_LABELS.length - 1

export function Order () {
  const t = useT()
  const { locale } = useLocale()

  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  const [draft, setDraft] = useState<Draft>({ country: 'ANY', email: '', spDc: '', terms: false, waiver: false })
  const [step, setStep] = useState(0)
  const [attempted, setAttempted] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getCatalog(controller.signal)
      .then((found) => { setCatalog(found); setLoadError(null) })
      .catch((cause: unknown) => { if (!isAbort(cause)) setLoadError(errorMessage(cause)) })
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

  const invalid = STEP_FIELDS[step].some((key) => problems[key] !== undefined)
  const shown = (key: keyof Problems): string | undefined => (attempted ? problems[key] : undefined)

  const set = <K extends keyof Draft>(key: K, value: Draft[K]): void =>
    setDraft((current) => ({ ...current, [key]: value }))

  const next = (): void => {
    if (invalid) { setAttempted(true); return }
    setAttempted(false)
    setStep((current) => current + 1)
  }

  const back = (): void => { setAttempted(false); setActionError(null); setStep((current) => current - 1) }

  const submit = (): void => {
    setSubmitting(true)
    setActionError(null)
    createOrder({ plan: plan.id, country: draft.country, email: draft.email, spDc: draft.spDc, locale })
      .then((created) => { window.location.assign(created.paymentUrl) })
      .catch((cause: unknown) => { setActionError(refusalMessage(cause)); setSubmitting(false) })
  }

  const countryLabel = (code: string): string => (code === 'ANY' ? t('Any available country') : code)

  return (
    <div className='card space-y-6'>
      <div className='card-header'>
        <h3 className='card-title'>{t('Order your upgrade')}</h3>
      </div>

      <ol className='stepper' aria-label={t('Order steps')}>
        {STEP_LABELS.map((label, index) => (
          <li key={label} className={`stepper-item ${index === step ? 'stepper-current' : index < step ? 'stepper-done' : 'stepper-upcoming'}`}>
            <span className='stepper-dot' aria-hidden='true'>{index + 1}</span>
            <span className='stepper-label'>{t(label)}</span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className='wizard-step space-y-4'>
          <div className='offer'>
            <span className='offer-name'>{t(plan.label)}</span>
            <span className='offer-price'>{money(plan.priceCents)}</span>
          </div>
          <p className='card-text'>{t('A one-time upgrade of your own Spotify account to Premium, kept active with free renewals.')}</p>
          <Field label={t('Country')} htmlFor='order-country' problem={undefined} hint={t('Pick a country, or let us choose any available one.')}>
            <select id='order-country' className='form-select' value={draft.country} onChange={(event) => { set('country', event.target.value) }}>
              {countries.map((code) => <option key={code} value={code}>{countryLabel(code)}</option>)}
            </select>
          </Field>
        </section>
      )}

      {step === 1 && (
        <section className='wizard-step space-y-4'>
          <p className='card-text'>
            {t('Paste your Spotify session key (the sp_dc cookie). We never ask for your password, we encrypt it, and we delete it once your upgrade is done.')}
          </p>
          <SpotifyKeyField id='order-spdc' value={draft.spDc} problem={shown('spDc')} onChange={(value) => { set('spDc', value) }} />
          <button type='button' className='link-button' onClick={() => { setGuideOpen(true) }}>{t('Where do I find it?')}</button>
        </section>
      )}

      {step === 2 && (
        <section className='wizard-step space-y-4'>
          <Field label={t('Email')} htmlFor='order-email' problem={shown('email')} hint={t('We send your order number and updates here.')}>
            <input
              {...fieldMarks('order-email', shown('email'), 'order-email-hint')}
              id='order-email'
              type='email'
              autoComplete='email'
              value={draft.email}
              onChange={(event) => { set('email', event.target.value) }}
            />
          </Field>
          <label className='form-check'>
            <input type='checkbox' checked={draft.terms} onChange={(event) => { set('terms', event.target.checked) }} />
            {t('I accept the terms of service.')}
          </label>
          {shown('terms') !== undefined && <p className='field-error'>{shown('terms')}</p>}
          <label className='form-check'>
            <input type='checkbox' checked={draft.waiver} onChange={(event) => { set('waiver', event.target.checked) }} />
            {t('I want my upgrade right away and waive my 14-day right of withdrawal.')}
          </label>
          {shown('waiver') !== undefined && <p className='field-error'>{shown('waiver')}</p>}
        </section>
      )}

      {step === LAST_STEP && (
        <section className='wizard-step space-y-4'>
          <h4 className='card-subtitle'>{t('Review your order')}</h4>
          <dl className='summary'>
            <div className='summary-row'><dt>{t('Offer')}</dt><dd>{t(plan.label)} — {money(plan.priceCents)}</dd></div>
            <div className='summary-row'><dt>{t('Country')}</dt><dd>{countryLabel(draft.country)}</dd></div>
            <div className='summary-row'><dt>{t('Email')}</dt><dd>{draft.email}</dd></div>
            <div className='summary-row'><dt>{t('Spotify session key')}</dt><dd>{t('Provided')}</dd></div>
          </dl>
          <p className='card-text'>{t('You will be sent to a secure payment page to finish.')}</p>
        </section>
      )}

      {actionError !== null && <div className='alert-error'>{actionError}</div>}

      <div className='wizard-nav'>
        {step > 0 && <button type='button' className='btn btn-ghost' onClick={back}>{t('Back')}</button>}
        {step < LAST_STEP
          ? <button type='button' className='btn btn-primary' onClick={next}>{t('Continue')}</button>
          : (
            <button type='button' className='btn btn-primary' disabled={submitting} onClick={submit}>
              {submitting ? t('Starting…') : t('Pay securely')}
            </button>
            )}
      </div>

      {guideOpen && <SpotifyKeyGuide onClose={() => { setGuideOpen(false) }} />}
    </div>
  )
}
