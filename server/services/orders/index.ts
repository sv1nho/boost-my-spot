import { prisma } from '../../prisma.js'
import { AppError } from '../../errors.js'
import { log } from '../../log.js'
import { orderReceivedEmail } from '../../emails.js'
import { PLANS, PLAN_CURRENCY } from '../../../shared/plans.js'
import { generateReference } from './reference.js'
import { toCatalog, toOrderView } from './mapper.js'
import { advanceOrder } from './transition.js'
import type { Catalog, CreateOrderInput, CreatedOrder, OrderView } from '../../../shared/order.js'
import type { SecretBox } from '../secret-box.js'
import type { OrderLink } from '../order-link.js'
import type { Upgrader } from '../upgrader.js'
import type { Mailer } from '../mail.js'
import type { Promos } from '../promo/index.js'
import type { PaymentNotification, PaymentProvider } from '../payments/provider.js'

type Deps = {
  secretBox: SecretBox
  orderLink: OrderLink
  upgrader: Upgrader
  payments: PaymentProvider
  mailer: Mailer
  promos: Promos
  now: () => Date
  config: { paymentWindowMinutes: number; publicUrl: string }
}

export type Orders = {
  catalog: () => Promise<Catalog>
  create: (input: CreateOrderInput) => Promise<CreatedOrder>
  view: (token: string) => Promise<OrderView>
  lookup: (input: { reference: string; email: string }) => Promise<{ token: string }>
  applyPayment: (notification: PaymentNotification) => Promise<void>
  submitSpotify: (token: string, spDc: string) => Promise<OrderView>
}

const MAX_REFERENCE_TRIES = 5

const isUniqueViolation = (cause: unknown): boolean =>
  typeof cause === 'object' && cause !== null && 'code' in cause &&
  (cause).code === 'P2002'

const availableCountries = (stock: Record<string, number>): string[] =>
  Object.entries(stock)
    .filter(([, count]) => count > 0)
    .map(([code]) => code)

export function createOrders ({ secretBox, orderLink, upgrader, payments, mailer, promos, now, config }: Deps): Orders {
  const hasStock = (stock: Record<string, number>, country: string): boolean =>
    country === 'ANY' ? Object.values(stock).some((count) => count > 0) : (stock[country] ?? 0) > 0

  const sendReceipt = async (email: string, reference: string, token: string, locale: string): Promise<void> => {
    try {
      await mailer.send(orderReceivedEmail({ email, reference, trackingLink: `${config.publicUrl}/orders/${token}`, locale }))
    } catch (cause) {
      log('warn', 'could not send the order email', { reference, cause: String(cause) })
    }
  }

  const notFound = (): never => {
    throw new AppError('NOT_FOUND', 'This order could not be found.')
  }

  const catalog = async (): Promise<Catalog> => {
    const { countries } = await upgrader.stock()
    return toCatalog(availableCountries(countries))
  }

  const create = async (input: CreateOrderInput): Promise<CreatedOrder> => {
    const { countries } = await upgrader.stock()
    if (!hasStock(countries, input.country)) {
      throw new AppError('CONFLICT', 'That country is out of stock right now.')
    }

    const listPrice = PLANS[input.plan].priceCents
    const redemption = input.promoCode === undefined
      ? { code: null, discountCents: 0, finalCents: listPrice }
      : await promos.redeem(input.promoCode, listPrice)

    const free = redemption.finalCents === 0
    const sealed = secretBox.seal(input.spDc)

    const baseData = {
      email: input.email.toLowerCase(),
      locale: input.locale,
      plan: input.plan,
      country: input.country,
      priceCents: redemption.finalCents,
      discountCents: redemption.discountCents,
      promoCode: redemption.code,
      currency: PLAN_CURRENCY,
      spDcSealed: new Uint8Array(sealed),
    }

    const statusData = free
      ? { status: 'paid', paidAt: now(), events: { create: { status: 'paid', actor: 'system', note: 'Free order (promo)' } } }
      : {
          status: 'awaiting_payment',
          expiresAt: new Date(now().getTime() + config.paymentWindowMinutes * 60_000),
          events: { create: { status: 'awaiting_payment', actor: 'system', note: 'Order created' } },
        }

    let order
    for (let attempt = 1; ; attempt += 1) {
      try {
        order = await prisma.order.create({ data: { reference: generateReference(), ...baseData, ...statusData } })
        break
      } catch (cause) {
        if (isUniqueViolation(cause) && attempt < MAX_REFERENCE_TRIES) continue
        throw cause
      }
    }

    const token = orderLink.sign(order.id)

    if (free) {
      await sendReceipt(order.email, order.reference, token, order.locale)
      return { token, paymentUrl: null }
    }

    const invoice = await payments.createInvoice({
      reference: order.reference,
      amountCents: redemption.finalCents,
      currency: PLAN_CURRENCY,
      successUrl: `${config.publicUrl}/orders/${token}?paid=1`,
      callbackUrl: `${config.publicUrl}/api/payments/nowpayments`,
    })

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentProvider: 'nowpayments', paymentId: invoice.id },
    })

    await sendReceipt(order.email, order.reference, token, order.locale)

    return { token, paymentUrl: invoice.url }
  }

  const view = async (token: string): Promise<OrderView> => {
    const id = orderLink.verify(token)
    if (id === null) return notFound()

    const order = await prisma.order.findUnique({ where: { id } })
    if (order === null) return notFound()

    return toOrderView(order)
  }

  const lookup = async ({ reference, email }: { reference: string; email: string }): Promise<{ token: string }> => {
    const order = await prisma.order.findFirst({
      where: { reference, email: email.toLowerCase() },
      select: { id: true },
    })
    if (order === null) return notFound()

    return { token: orderLink.sign(order.id) }
  }

  const applyPayment = async (notification: PaymentNotification): Promise<void> => {
    const order = await prisma.order.findFirst({
      where: { reference: notification.reference },
      select: { id: true, status: true, priceCents: true, currency: true },
    })
    if (order === null) return

    if (notification.status === 'paid') {
      const matches =
        notification.priceAmountCents === order.priceCents && notification.currency === order.currency
      if (matches) {
        await advanceOrder(order, 'paid', 'payment', 'Payment received', { paidAt: now() })
      } else {
        await advanceOrder(order, 'underpaid', 'payment', 'Payment did not match the order total')
      }
      return
    }

    if (notification.status === 'underpaid') {
      await advanceOrder(order, 'underpaid', 'payment', 'Partial payment received')
      return
    }

    await advanceOrder(order, 'expired', 'payment', 'Payment window expired')
  }

  const submitSpotify = async (token: string, spDc: string): Promise<OrderView> => {
    const id = orderLink.verify(token)
    if (id === null) return notFound()

    const order = await prisma.order.findUnique({ where: { id } })
    if (order === null) return notFound()

    const sealed = new Uint8Array(secretBox.seal(spDc))

    if (order.status === 'needs_action') {
      await advanceOrder(order, 'paid', 'customer', 'New session key provided', { spDcSealed: sealed })
    } else if (order.status === 'active') {
      await advanceOrder(order, 'renewing', 'customer', 'Warranty renewal requested', { spDcSealed: sealed })
    } else {
      throw new AppError('CONFLICT', 'This order is not waiting for a session key.')
    }

    return toOrderView(await prisma.order.findUniqueOrThrow({ where: { id } }))
  }

  return { catalog, create, view, lookup, applyPayment, submitSpotify }
}
