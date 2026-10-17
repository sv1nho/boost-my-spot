import { env } from '../env.js'
import { log } from '../log.js'
import { mailer, orderLink, secretBox, upgrader } from '../deps.js'
import { createWorker } from './index.js'

const INTERVAL_MS = 5_000

export function startWorker (): () => void {
  const worker = createWorker({
    upgrader,
    mailer,
    secretBox,
    orderLink,
    now: () => new Date(),
    publicUrl: env.WEB_ORIGIN,
    config: { batchSize: 10, maxAttempts: 5, backoffSeconds: 60 },
  })

  let running = false
  const tick = (): void => {
    if (running) return
    running = true
    worker
      .runOnce()
      .catch((cause: unknown) => {
        log('error', 'worker pass failed', { cause: String(cause) })
      })
      .finally(() => {
        running = false
      })
  }

  const timer = setInterval(tick, INTERVAL_MS)
  timer.unref()

  return () => {
    clearInterval(timer)
  }
}
