type Invoice = { id: string; url: string }

export type PaymentNotification = {
  reference: string
  status: 'paid' | 'underpaid' | 'expired'
  priceAmountCents: number
  currency: string
}

type CreateInvoiceInput = {
  reference: string
  amountCents: number
  currency: string
  successUrl: string
  callbackUrl: string
}

export type PaymentProvider = {
  createInvoice: (input: CreateInvoiceInput) => Promise<Invoice>
  verifyNotification: (rawBody: string, signature: string) => PaymentNotification | null
}
