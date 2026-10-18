import { useEffect, useState } from 'react'
import { getKeyStats, importKeys } from '../api/admin.js'
import { errorMessage, isAbort, refusalMessage } from '../api/client.js'
import { PendingNote } from '../components/PendingNote.js'
import { useT } from '../i18n/context.js'
import { PLAN_IDS, PLANS } from '../../shared/plans.js'
import type { PlanId } from '../../shared/plans.js'
import type { ImportKeysResult, KeyStat } from '../../shared/admin.js'

export function AdminKeys () {
  const t = useT()
  const [stats, setStats] = useState<KeyStat[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [plan, setPlan] = useState<PlanId>(PLAN_IDS[0])
  const [raw, setRaw] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportKeysResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getKeyStats(controller.signal)
      .then((data) => { setStats(data.keys); setError(null) })
      .catch((cause: unknown) => { if (!isAbort(cause)) setError(errorMessage(cause)) })
    return () => { controller.abort() }
  }, [reloadKey])

  const submit = (): void => {
    setImporting(true)
    setImportError(null)
    setResult(null)
    importKeys({ plan, keys: raw })
      .then((imported) => { setResult(imported); setRaw(''); setImporting(false); setReloadKey((key) => key + 1) })
      .catch((cause: unknown) => { setImportError(refusalMessage(cause)); setImporting(false) })
  }

  return (
    <div className='space-y-6'>
      <div className='card space-y-4'>
        <h2 className='card-title'>{t('Upgrade keys')}</h2>

        {error !== null && (
          <div className='space-y-3'>
            <div className='alert-error'>{error}</div>
            <button type='button' className='link-button' onClick={() => { setStats(null); setError(null); setReloadKey((key) => key + 1) }}>
              {t('Try again')}
            </button>
          </div>
        )}

        {error === null && stats === null && <PendingNote label={t('Loading keys…')} />}

        {error === null && stats !== null && (
          <div className='admin-table-wrap'>
            <table className='admin-table'>
              <thead>
                <tr>
                  <th>{t('Plan')}</th>
                  <th>{t('Available')}</th>
                  <th>{t('Used')}</th>
                  <th>{t('Total')}</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((stat) => (
                  <tr key={stat.plan}>
                    <td>{PLANS[stat.plan].label}</td>
                    <td>{stat.available}</td>
                    <td>{stat.used}</td>
                    <td>{stat.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <form className='card space-y-4' onSubmit={(event) => { event.preventDefault(); submit() }} noValidate>
        <h3 className='card-subtitle'>{t('Import keys')}</h3>
        <p className='card-text'>{t('Paste one key per line. Duplicates are skipped.')}</p>

        <label className='form-label' htmlFor='import-plan'>{t('Plan')}</label>
        <select
          id='import-plan'
          className='form-select'
          value={plan}
          onChange={(event) => { setPlan(event.target.value as PlanId) }}
        >
          {PLAN_IDS.map((id) => (
            <option key={id} value={id}>{PLANS[id].label}</option>
          ))}
        </select>

        <textarea
          className='form-input form-textarea'
          aria-label={t('Keys')}
          rows={6}
          value={raw}
          onChange={(event) => { setRaw(event.target.value) }}
          placeholder={'KEY-1\nKEY-2'}
        />

        {importError !== null && <div className='alert-error'>{importError}</div>}

        {result !== null && (
          <div className='alert-info'>
            {t('Imported {imported}, skipped {skipped}.', { imported: result.imported, skipped: result.skipped })}
          </div>
        )}

        <button type='submit' className='btn btn-primary' disabled={importing || raw.trim().length === 0}>
          {importing ? t('Importing…') : t('Import keys')}
        </button>
      </form>
    </div>
  )
}
