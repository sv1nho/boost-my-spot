import { Spinner } from './Spinner.js'

export function PendingNote ({ label }: { label: string }) {
  return (
    <div className='pending-note'>
      <Spinner />
      <span>{label}</span>
    </div>
  )
}
