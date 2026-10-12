import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 12
const TAG_LENGTH = 16

type SecretBox = {
  seal: (plaintext: string) => Buffer
  open: (sealed: Buffer) => string
}

export function createSecretBox (key: Buffer): SecretBox {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`secret box key must be ${String(KEY_LENGTH)} bytes, got ${String(key.length)}`)
  }

  const seal = (plaintext: string): Buffer => {
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, key, iv)
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext])
  }

  const open = (sealed: Buffer): string => {
    if (sealed.length < IV_LENGTH + TAG_LENGTH) {
      throw new Error('sealed value is too short to be valid')
    }
    const iv = sealed.subarray(0, IV_LENGTH)
    const tag = sealed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const ciphertext = sealed.subarray(IV_LENGTH + TAG_LENGTH)
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  }

  return { seal, open }
}
