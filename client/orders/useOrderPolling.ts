import { useEffect, useRef, useState } from 'react'
import { getOrder } from '../api/orders.js'
import { errorMessage, isAbort } from '../api/client.js'
import type { OrderStatus } from '../../shared/order-status.js'
import type { OrderView } from '../../shared/order.js'

const POLL_MS = 10_000
const SETTLED = new Set<OrderStatus>(['active', 'refunded', 'failed', 'needs_action', 'expired'])

type Change = (next: OrderStatus, previous: OrderStatus | null) => void

export function useOrderPolling (token: string, onChange?: Change) {
  const [order, setOrder] = useState<OrderView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const previous = useRef<OrderStatus | null>(null)
  const changeRef = useRef<Change | undefined>(onChange)
  changeRef.current = onChange

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false
    previous.current = null

    const schedule = (): void => {
      timer = setTimeout(() => {
        if (document.hidden) { schedule(); return }
        void poll()
      }, POLL_MS)
    }

    const poll = async (): Promise<void> => {
      try {
        const found = await getOrder(token, controller.signal)
        if (stopped) return
        setError(null)
        if (previous.current !== found.status) {
          const was = previous.current
          previous.current = found.status
          changeRef.current?.(found.status, was)
        }
        setOrder(found)
        if (!SETTLED.has(found.status)) schedule()
      } catch (cause) {
        if (stopped || isAbort(cause)) return
        setError(errorMessage(cause))
        schedule()
      }
    }

    void poll()
    return () => {
      stopped = true
      controller.abort()
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [token, reload])

  return { order, error, reload: () => { setReload((n) => n + 1) } }
}
