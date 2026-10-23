import { createPortal } from 'react-dom'
import { useT } from '../i18n/context.js'

const STEPS = [
  'Open open.spotify.com in your browser and sign in to your account.',
  'Open your browser developer tools (press F12), then the Application tab.',
  'In the left menu, open Cookies → https://open.spotify.com.',
  'Find the row named sp_dc, copy its value, and paste it here. We never ask for your password.',
] as const

export function SpotifyKeyGuide ({ onClose }: { onClose: () => void }) {
  const t = useT()

  return createPortal(
    <div className='dialog-overlay' role='dialog' aria-modal='true' aria-label={t('Where to find your session key')}>
      <div className='dialog-card guide-card'>
        <div className='guide-head'>
          <h3 className='dialog-title'>{t('Where to find your session key')}</h3>
          <button type='button' className='guide-close' aria-label={t('Close')} onClick={onClose}>×</button>
        </div>

        <p className='card-text'>
          {t('You need a computer with a desktop browser — on a phone it is much harder. It takes about a minute.')}
        </p>

        <ol className='guide-steps'>
          {STEPS.map((step, index) => (
            <li key={step} className='guide-step'>
              <span className='guide-step-number' aria-hidden='true'>{index + 1}</span>
              <div className='guide-step-body'>
                <figure className='guide-figure'>
                  <div className='guide-figure-placeholder'>{t('Screenshot {n}', { n: index + 1 })}</div>
                </figure>
                <p className='guide-step-text'>{t(step)}</p>
              </div>
            </li>
          ))}
        </ol>

        <button type='button' className='btn btn-primary' onClick={onClose}>{t('Got it')}</button>
      </div>
    </div>,
    document.body
  )
}
