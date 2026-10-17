import { useT } from '../i18n/context.js'
import { milestones } from './progress.js'
import type { OrderStatus } from '../../shared/order-status.js'

const stepClass = (done: boolean, current: boolean): string =>
  done ? 'timeline-step timeline-step-done' : current ? 'timeline-step timeline-step-current' : 'timeline-step'

export function OrderTimeline ({ status }: { status: OrderStatus }) {
  const t = useT()
  return (
    <ol className='timeline'>
      {milestones(status).map((milestone) => (
        <li key={milestone.label} className={stepClass(milestone.done, milestone.current)}>
          <span className='timeline-mark' aria-hidden='true' />
          <span className='timeline-label'>{t(milestone.label)}</span>
        </li>
      ))}
    </ol>
  )
}
