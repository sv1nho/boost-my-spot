import { useT } from '../i18n/context.js'

export function Help () {
  const t = useT()

  return (
    <div className='card'>
      <div className='card-header'>
        <h3 className='card-title'>{t('Help & FAQ')}</h3>
      </div>
      <p className='card-text'>{t('The help guide is on its way.')}</p>
    </div>
  )
}
