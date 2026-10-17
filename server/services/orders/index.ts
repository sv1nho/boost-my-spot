import { prisma } from '../../prisma.js'
import { AppError } from '../../errors.js'
import { PLANS, PLAN_CURRENCY } from '../../../shared/plans.js'
import { generateReference } from './reference.js'
import { toCatalog, toOrderView } from './mapper.js'
import { advanceOrder } from './transition.js'
import type { Catalog, CreateOrderInput, CreatedOrder, OrderView } from '../../../shared/order.js'
import type { SecretBox } from '../secret-box.js'
import type { OrderLink } from '../order-link.js'
import type { Upgrader } from '../upgrader.js'
import type { PaymentNotification, PaymentProvider } from '../payments/provider.js'

type Deps = {
  secretBox: SecretBox
  orderLink: OrderLink
  upgrader: Upgrader
  payments: PaymentProvider
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

export function createOrders ({ secretBox, orderLink, upgrader, payments, now, config }: Deps): Orders {
  const hasStock = (stock: Record<string, number>, country: string): boolean =>
    country === 'ANY' ? Object.values(stock).some((count) => count > 0) : (stock[country] ?? 0) > 0

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

    const priceCents = PLANS[input.plan].priceCents
    const sealed = secretBox.seal(input.spDc)
    const expiresAt = new Date(now().getTime() + config.paymentWindowMinutes * 60_000)

    let order
    for (let attempt = 1; ; attempt += 1) {
      try {
        order = await prisma.order.create({
          data: {
            reference: generateReference(),
            email: input.email.toLowerCase(),
            locale: input.locale,
            plan: input.plan,
            country: input.country,
            priceCents,
            currency: PLAN_CURRENCY,
            status: 'awaiting_payment',
            spDcSealed: new Uint8Array(sealed),
            expiresAt,
            events: { create: { status: 'awaiting_payment', actor: 'system', note: 'Order created' } },
          },
        })
        break
      } catch (cause) {
        if (isUniqueViolation(cause) && attempt < MAX_REFERENCE_TRIES) continue
        throw cause
      }
    }

    const token = orderLink.sign(order.id)
    const invoice = await payments.createInvoice({
      reference: order.reference,
      amountCents: priceCents,
      currency: PLAN_CURRENCY,
      successUrl: `${config.publicUrl}/orders/${token}?paid=1`,
      callbackUrl: `${config.publicUrl}/api/payments/nowpayments`,
    })

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentProvider: 'nowpayments', paymentId: invoice.id },
    })

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
