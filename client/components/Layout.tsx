import { NavLink, Outlet, useNavigate } from 'react-router'
import { LanguageToggle } from '../i18n/LanguageToggle.js'
import { useT } from '../i18n/context.js'

const linkClass = ({ isActive }: { isActive: boolean }): string =>
  isActive ? 'navbar-link navbar-link-active' : 'navbar-link'

export function Layout () {
  const navigate = useNavigate()
  const t = useT()

  return (
    <div className='page-wrapper'>
      <nav className='navbar'>
        <div className='navbar-inner'>
          <button
            type='button'
            className='navbar-brand'
            onClick={() => { void navigate('/') }}
          >
            <span className='navbar-brand-mark' aria-hidden='true'>
              <svg
                width='16'
                height='16'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <circle cx='12' cy='12' r='9' />
                <path d='M7.5 10.2c3-0.8 6.2-0.5 9 1' />
                <path d='M8 13.2c2.3-0.6 4.7-0.3 6.8 0.9' />
                <path d='M8.6 15.9c1.7-0.4 3.4-0.2 4.9 0.7' />
              </svg>
            </span>
            boost-my-spot
          </button>
          <div className='navbar-links'>
            <NavLink to='/order' className={linkClass}>{t('Order')}</NavLink>
            <NavLink to='/track' className={linkClass}>{t('Track')}</NavLink>
            <NavLink to='/help' className={linkClass}>{t('Help')}</NavLink>
            <LanguageToggle />
          </div>
        </div>
      </nav>
      <main className='page-content'>
        <Outlet />
      </main>
      <div className='site-footer'>
        <strong>boost-my-spot</strong> {t('— Spotify Premium upgrades')}
        <br />
        {t('Not affiliated with, or endorsed by, Spotify AB.')}
      </div>
    </div>
  )
}
