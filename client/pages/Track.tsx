import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Field, fieldMarks } from '../components/Field.js'
import { lookupOrder } from '../api/orders.js'
import { refusalMessage } from '../api/client.js'
import { useT } from '../i18n/context.js'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function Track () {
  const t = useT()
  const navigate = useNavigate()

  const [reference, setReference] = useState('')
  const [email, setEmail] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const problems = {
    reference: reference.trim() === '' ? t('Enter your order number.') : undefined,
    email: EMAIL.test(email) ? undefined : t('Enter a valid email address.'),
  }
  const shown = (key: 'reference' | 'email'): string | undefined => (attempted ? problems[key] : undefined)

  const submit = (): void => {
    setAttempted(true)
    setError(null)
    if (problems.reference !== undefined || problems.email !== undefined) return

    setSubmitting(true)
    lookupOrder({ reference: reference.trim().toUpperCase(), email })
      .then((found) => { void navigate(`/orders/${found.token}`) })
      .catch((cause: unknown) => { setError(refusalMessage(cause)); setSubmitting(false) })
  }

  return (
    <div className='card space-y-6'>
      <div className='card-header'>
        <h3 className='card-title'>{t('Track your order')}</h3>
      </div>
      <p className='card-text'>{t('Enter your order number and the email you used.')}</p>

      <form className='space-y-4' onSubmit={(event) => { event.preventDefault(); submit() }} noValidate>
        <Field label={t('Order number')} htmlFor='track-reference' problem={shown('reference')} hint='BMS-XXXXXXXX'>
          <input
            {...fieldMarks('track-reference', shown('reference'), 'track-reference-hint')}
            id='track-reference'
            value={reference}
            onChange={(event) => { setReference(event.target.value) }}
          />
        </Field>

        <Field label={t('Email')} htmlFor='track-email' problem={shown('email')}>
          <input
            {...fieldMarks('track-email', shown('email'))}
            id='track-email'
            type='email'
            autoComplete='email'
            value={email}
            onChange={(event) => { setEmail(event.target.value) }}
          />
        </Field>

        {error !== null && <div className='alert-error'>{error}</div>}

        <div className='form-actions'>
          <button type='submit' className='btn btn-primary' disabled={submitting}>
            {submitting ? t('Looking…') : t('Find my order')}
          </button>
        </div>
      </form>
    </div>
  )
}
