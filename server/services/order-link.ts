import { createHmac, timingSafeEqual } from 'node:crypto'

export type OrderLink = {
  sign: (orderId: string) => string
  verify: (token: string) => string | null
}

export function createOrderLink (secret: string): OrderLink {
  const mac = (orderId: string): string =>
    createHmac('sha256', secret).update(orderId).digest('base64url')

  const sign = (orderId: string): string => `${orderId}.${mac(orderId)}`

  const verify = (token: string): string | null => {
    const dot = token.lastIndexOf('.')
    if (dot <= 0 || dot === token.length - 1) return null

    const orderId = token.slice(0, dot)
    const given = Buffer.from(token.slice(dot + 1))
    const expected = Buffer.from(mac(orderId))

    if (given.length !== expected.length) return null
    if (!timingSafeEqual(given, expected)) return null

    return orderId
  }

  return { sign, verify }
}
