import { useT } from '../i18n/context.js'

export function Track () {
  const t = useT()

  return (
    <div className='card'>
      <div className='card-header'>
        <h3 className='card-title'>{t('Track your order')}</h3>
      </div>
      <p className='card-text'>{t('Order tracking is on its way.')}</p>
    </div>
  )
}
