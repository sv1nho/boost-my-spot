import { useT } from '../i18n/context.js'

export function Order () {
  const t = useT()

  return (
    <div className='card'>
      <div className='card-header'>
        <h3 className='card-title'>{t('Order an upgrade')}</h3>
      </div>
      <p className='card-text'>{t('The order form is on its way.')}</p>
    </div>
  )
}
