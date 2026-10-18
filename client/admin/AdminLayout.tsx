import { NavLink, Outlet, useNavigate } from 'react-router'
import { signOut, useSession } from '../auth/client.js'
import { useT } from '../i18n/context.js'

const linkClass = ({ isActive }: { isActive: boolean }): string =>
  isActive ? 'admin-tab admin-tab-active' : 'admin-tab'

export function AdminLayout () {
  const navigate = useNavigate()
  const { data: session } = useSession()
  const t = useT()

  const handleSignOut = (): void => {
    void signOut().then(() => navigate('/login'))
  }

  return (
    <div className='admin-shell'>
      <div className='admin-bar'>
        <nav className='admin-tabs'>
          <NavLink end to='/admin' className={linkClass}>{t('Orders')}</NavLink>
          <NavLink to='/admin/keys' className={linkClass}>{t('Keys')}</NavLink>
        </nav>
        <div className='admin-session'>
          {session !== null && <span className='admin-user'>{session.user.email}</span>}
          <button type='button' className='btn btn-ghost btn-compact' onClick={handleSignOut}>
            {t('Sign out')}
          </button>
        </div>
      </div>
      <Outlet />
    </div>
  )
}
