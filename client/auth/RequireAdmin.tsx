import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from './client.js'
import { PendingNote } from '../components/PendingNote.js'
import { useT } from '../i18n/context.js'

export function RequireAdmin () {
  const { data: session, isPending } = useSession()
  const location = useLocation()
  const t = useT()

  if (isPending) {
    return <PendingNote label={t('Checking your session…')} />
  }

  if (!session) {
    const target = `${location.pathname}${location.search}`
    return <Navigate to={`/login?redirect=${encodeURIComponent(target)}`} replace />
  }

  return <Outlet />
}
