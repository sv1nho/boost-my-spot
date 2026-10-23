import { prisma } from '../../prisma.js'
import { AppError } from '../../errors.js'
import { applyDiscount, normalizeCode } from '../../../shared/promo.js'
import type { PromoKind, PromoPreview } from '../../../shared/promo.js'
import type { CreatePromoInput, PromoSummary } from '../../../shared/admin.js'

type Deps = { now: () => Date }

type PromoRow = {
  id: string
  code: string
  kind: string
  value: number
  active: boolean
  expiresAt: Date | null
  maxRedemptions: number | null
  redemptions: number
  createdAt: Date
}

type Redemption = { code: string; discountCents: number; finalCents: number }

export type Promos = {
  preview: (code: string, priceCents: number) => Promise<PromoPreview>
  redeem: (code: string, priceCents: number) => Promise<Redemption>
  list: () => Promise<PromoSummary[]>
  create: (input: CreatePromoInput) => Promise<PromoSummary>
  setActive: (id: string, active: boolean) => Promise<PromoSummary>
}

const toSummary = (row: PromoRow): PromoSummary => ({
  id: row.id,
  code: row.code,
  kind: row.kind as PromoKind,
  value: row.value,
  active: row.active,
  expiresAt: row.expiresAt === null ? null : row.expiresAt.toISOString(),
  maxRedemptions: row.maxRedemptions,
  redemptions: row.redemptions,
  createdAt: row.createdAt.toISOString(),
})

const invalid = (): never => {
  throw new AppError('BAD_REQUEST', 'This promo code cannot be used.')
}

const isUniqueViolation = (cause: unknown): boolean =>
  typeof cause === 'object' && cause !== null && 'code' in cause && (cause).code === 'P2002'

export function createPromos ({ now }: Deps): Promos {
  const usable = (promo: PromoRow | null): promo is PromoRow =>
    promo !== null &&
    promo.active &&
    (promo.expiresAt === null || promo.expiresAt > now()) &&
    (promo.maxRedemptions === null || promo.redemptions < promo.maxRedemptions)

  const discountOf = (promo: PromoRow, priceCents: number): Redemption => {
    const { discountCents, finalCents } = applyDiscount(priceCents, { kind: promo.kind as PromoKind, value: promo.value })
    return { code: promo.code, discountCents, finalCents }
  }

  const preview = async (code: string, priceCents: number): Promise<PromoPreview> => {
    const promo = await prisma.promoCode.findUnique({ where: { code: normalizeCode(code) } })
    if (!usable(promo)) return invalid()
    return discountOf(promo, priceCents)
  }

  const redeem = async (code: string, priceCents: number): Promise<Redemption> => {
    const promo = await prisma.promoCode.findUnique({ where: { code: normalizeCode(code) } })
    if (!usable(promo)) return invalid()

    const claimed = await prisma.promoCode.updateMany({
      where: {
        id: promo.id,
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now() } }],
        ...(promo.maxRedemptions === null ? {} : { redemptions: { lt: promo.maxRedemptions } }),
      },
      data: { redemptions: { increment: 1 } },
    })
    if (claimed.count === 0) return invalid()

    return discountOf(promo, priceCents)
  }

  const list = async (): Promise<PromoSummary[]> => {
    const rows = await prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } })
    return rows.map(toSummary)
  }

  const create = async (input: CreatePromoInput): Promise<PromoSummary> => {
    try {
      const row = await prisma.promoCode.create({
        data: {
          code: normalizeCode(input.code),
          kind: input.kind,
          value: input.value,
          expiresAt: input.expiresAt ?? null,
          maxRedemptions: input.maxRedemptions ?? null,
        },
      })
      return toSummary(row)
    } catch (cause) {
      if (isUniqueViolation(cause)) throw new AppError('CONFLICT', 'A promo code with that name already exists.')
      throw cause
    }
  }

  const setActive = async (id: string, active: boolean): Promise<PromoSummary> => {
    const updated = await prisma.promoCode.updateMany({ where: { id }, data: { active } })
    if (updated.count === 0) throw new AppError('NOT_FOUND', 'This promo code could not be found.')
    const row = await prisma.promoCode.findUniqueOrThrow({ where: { id } })
    return toSummary(row)
  }

  return { preview, redeem, list, create, setActive }
}
