import { env } from './env.js'
import { createSecretBox } from './services/secret-box.js'
import { createOrderLink } from './services/order-link.js'
import { createUpgrader } from './services/upgrader.js'
import { createNowPayments } from './services/payments/nowpayments.js'
import { createOrders } from './services/orders/index.js'

const PAYMENT_WINDOW_MINUTES = 30

const required = (name: string, value: string | undefined): string => {
  if (value === undefined) throw new Error(`${name} is required to start order processing`)
  return value
}

const secretBox = createSecretBox(Buffer.from(required('SECRET_BOX_KEY', env.SECRET_BOX_KEY), 'hex'))
const orderLink = createOrderLink(required('ORDER_LINK_SECRET', env.ORDER_LINK_SECRET))

const upgrader = createUpgrader({
  fetch,
  baseUrl: required('UPGRADER_API_URL', env.UPGRADER_API_URL),
  apiKey: required('UPGRADER_API_KEY', env.UPGRADER_API_KEY),
})

export const payments = createNowPayments({
  fetch,
  baseUrl: required('NOWPAYMENTS_API_URL', env.NOWPAYMENTS_API_URL),
  apiKey: required('NOWPAYMENTS_API_KEY', env.NOWPAYMENTS_API_KEY),
  ipnSecret: required('NOWPAYMENTS_IPN_SECRET', env.NOWPAYMENTS_IPN_SECRET),
})

export const orders = createOrders({
  secretBox,
  orderLink,
  upgrader,
  payments,
  now: () => new Date(),
  config: { paymentWindowMinutes: PAYMENT_WINDOW_MINUTES, publicUrl: env.WEB_ORIGIN },
})
