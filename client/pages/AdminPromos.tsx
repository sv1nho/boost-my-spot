import { useEffect, useState } from 'react'
import { createPromo, listPromos, setPromoActive } from '../api/admin.js'
import { errorMessage, isAbort, refusalMessage } from '../api/client.js'
import { PendingNote } from '../components/PendingNote.js'
import { useT } from '../i18n/context.js'
import { PROMO_KINDS } from '../../shared/promo.js'
import type { PromoKind } from '../../shared/promo.js'
import type { CreatePromoInput, PromoSummary } from '../../shared/admin.js'

const valueLabel = (promo: PromoSummary): string =>
  promo.kind === 'percent' ? `${String(promo.value)}%` : `€${(promo.value / 100).toFixed(2)}`

const day = (iso: string): string => new Date(iso).toISOString().slice(0, 10)

export function AdminPromos () {
  const t = useT()
  const [promos, setPromos] = useState<PromoSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [code, setCode] = useState('')
  const [kind, setKind] = useState<PromoKind>('percent')
  const [value, setValue] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    listPromos(controller.signal)
      .then((data) => { setPromos(data.promos); setError(null) })
      .catch((cause: unknown) => { if (!isAbort(cause)) setError(errorMessage(cause)) })
    return () => { controller.abort() }
  }, [reloadKey])

  const reload = (): void => { setReloadKey((key) => key + 1) }

  const amount = Number(value)
  const validValue = Number.isInteger(amount) && amount >= 1 && (kind !== 'percent' || amount <= 100)

  const submit = (): void => {
    setCreating(true)
    setCreateError(null)
    const input: CreatePromoInput = {
      code,
      kind,
      value: amount,
      ...(expiresAt === '' ? {} : { expiresAt: new Date(expiresAt).toISOString() }),
      ...(maxUses === '' ? {} : { maxRedemptions: Number(maxUses) }),
    }
    createPromo(input)
      .then(() => { setCode(''); setValue(''); setExpiresAt(''); setMaxUses(''); setCreating(false); reload() })
      .catch((cause: unknown) => { setCreateError(refusalMessage(cause)); setCreating(false) })
  }

  const toggle = (promo: PromoSummary): void => {
    setPromoActive(promo.id, !promo.active)
      .then(() => { reload() })
      .catch((cause: unknown) => { setError(errorMessage(cause)) })
  }

  return (
    <div className='space-y-6'>
      <div className='card space-y-4'>
        <h2 className='card-title'>{t('Promo codes')}</h2>

        {error !== null && (
          <div className='space-y-3'>
            <div className='alert-error'>{error}</div>
            <button type='button' className='link-button' onClick={() => { setPromos(null); setError(null); reload() }}>{t('Try again')}</button>
          </div>
        )}

        {error === null && promos === null && <PendingNote label={t('Loading promo codes…')} />}

        {error === null && promos !== null && promos.length === 0 && (
          <p className='card-text'>{t('No promo codes yet.')}</p>
        )}

        {error === null && promos !== null && promos.length > 0 && (
          <div className='admin-table-wrap'>
            <table className='admin-table'>
              <thead>
                <tr>
                  <th>{t('Code')}</th>
                  <th>{t('Discount')}</th>
                  <th>{t('Uses')}</th>
                  <th>{t('Expiry')}</th>
                  <th>{t('Status')}</th>
                </tr>
              </thead>
              <tbody>
                {promos.map((promo) => (
                  <tr key={promo.id}>
                    <td className='promo-code-cell'>{promo.code}</td>
                    <td>{valueLabel(promo)}</td>
                    <td>{promo.redemptions}{promo.maxRedemptions === null ? '' : ` / ${String(promo.maxRedemptions)}`}</td>
                    <td>{promo.expiresAt === null ? '—' : day(promo.expiresAt)}</td>
                    <td>
                      <button
                        type='button'
                        className={promo.active ? 'promo-toggle promo-toggle-on' : 'promo-toggle'}
                        onClick={() => { toggle(promo) }}
                      >
                        {promo.active ? t('Active') : t('Inactive')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <form className='card space-y-4' onSubmit={(event) => { event.preventDefault(); submit() }} noValidate>
        <h3 className='card-subtitle'>{t('Create a promo code')}</h3>

        <label className='form-label' htmlFor='promo-code'>{t('Code')}</label>
        <input id='promo-code' className='form-input' value={code} onChange={(event) => { setCode(event.target.value) }} placeholder='HALLOWEEN' />

        <div className='promo-form-row'>
          <div>
            <label className='form-label' htmlFor='promo-kind'>{t('Discount')}</label>
            <select id='promo-kind' className='form-select' value={kind} onChange={(event) => { setKind(event.target.value as PromoKind) }}>
              {PROMO_KINDS.map((id) => (
                <option key={id} value={id}>{id === 'percent' ? t('Percentage (%)') : t('Amount off (€)')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className='form-label' htmlFor='promo-value'>{kind === 'percent' ? t('Percent (1–100)') : t('Cents off')}</label>
            <input id='promo-value' className='form-input' inputMode='numeric' value={value} onChange={(event) => { setValue(event.target.value) }} />
          </div>
        </div>

        <div className='promo-form-row'>
          <div>
            <label className='form-label' htmlFor='promo-expiry'>{t('Expiry (optional)')}</label>
            <input id='promo-expiry' className='form-input' type='date' value={expiresAt} onChange={(event) => { setExpiresAt(event.target.value) }} />
          </div>
          <div>
            <label className='form-label' htmlFor='promo-max'>{t('Max uses (optional)')}</label>
            <input id='promo-max' className='form-input' inputMode='numeric' value={maxUses} onChange={(event) => { setMaxUses(event.target.value) }} />
          </div>
        </div>

        {createError !== null && <div className='alert-error'>{createError}</div>}

        <button type='submit' className='btn btn-primary' disabled={creating || code.trim() === '' || !validValue}>
          {creating ? t('Creating…') : t('Create a promo code')}
        </button>
      </form>
    </div>
  )
}
