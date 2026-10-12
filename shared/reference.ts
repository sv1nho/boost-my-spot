const ORDER_REFERENCE_PATTERN = /^BMS-[0-9A-HJKMNP-TV-Z]{8}$/

export const isOrderReference = (value: unknown): value is string =>
  typeof value === 'string' && ORDER_REFERENCE_PATTERN.test(value)
