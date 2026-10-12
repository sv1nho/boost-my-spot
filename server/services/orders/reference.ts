import { randomInt } from 'node:crypto'

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const LENGTH = 8

export const generateReference = (): string => {
  let body = ''
  for (let index = 0; index < LENGTH; index += 1) {
    body += ALPHABET[randomInt(ALPHABET.length)]
  }
  return `BMS-${body}`
}
