import { useNavigate } from 'react-router'
import { useT } from '../i18n/context.js'

const STEPS = [
  { title: 'Pick a plan', text: 'Choose how long you want Premium and which country.' },
  { title: 'Connect your account', text: 'Paste your Spotify session key. We never ask for your password.' },
  { title: 'Enjoy Premium', text: 'Pay in crypto and follow your upgrade live on the tracking page.' },
]

export function Home () {
  const navigate = useNavigate()
  const t = useT()

  return (
    <div className='space-y-6'>
      <section className='hero'>
        <h1 className='hero-title'>{t('Spotify Premium, upgraded for you')}</h1>
        <p className='hero-text'>
          {t('We upgrade your existing Spotify account to Premium. No password, no new account — keep your playlists and your library.')}
        </p>
        <div className='card-actions'>
          <button type='button' className='btn btn-hero' onClick={() => { void navigate('/order') }}>
            {t('Start an upgrade')}
          </button>
          <button type='button' className='btn btn-ghost' onClick={() => { void navigate('/track') }}>
            {t('Track my order')}
          </button>
        </div>
      </section>

      <section className='card'>
        <div className='card-header'>
          <h3 className='card-title'>{t('How it works')}</h3>
        </div>
        <div className='grid grid-cols-1 sm:grid-cols-3 gap-6'>
          {STEPS.map((step, index) => (
            <div key={step.title} className='space-y-3'>
              <span className='card-count'>{index + 1}</span>
              <h4 className='card-title'>{t(step.title)}</h4>
              <p className='card-text'>{t(step.text)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
