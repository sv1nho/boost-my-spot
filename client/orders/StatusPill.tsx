import { useT } from '../i18n/context.js'
import { statusLabel } from './progress.js'
import type { OrderStatus } from '../../shared/order-status.js'

export function StatusPill ({ status }: { status: OrderStatus }) {
  const t = useT()
  return <span className={`status-pill status-${status}`}>{t(statusLabel(status))}</span>
}
