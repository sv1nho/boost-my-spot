import { describe, it, expect } from 'vitest'
import { randomBytes } from 'node:crypto'
import { createSecretBox } from '../../services/secret-box.js'

const key = randomBytes(32)

describe('secret box', () => {
  it('seals and opens a value back to its plaintext', () => {
    const box = createSecretBox(key)
    const sealed = box.seal('AQAxxxxxxx-the-cookie')
    expect(sealed).toBeInstanceOf(Buffer)
    expect(sealed.toString('utf8')).not.toContain('cookie')
    expect(box.open(sealed)).toBe('AQAxxxxxxx-the-cookie')
  })

  it('never produces the same ciphertext twice for the same input', () => {
    const box = createSecretBox(key)
    expect(box.seal('same').equals(box.seal('same'))).toBe(false)
  })

  it('refuses a key that is not 32 bytes', () => {
    expect(() => createSecretBox(randomBytes(16))).toThrow(/32 bytes/)
  })

  it('rejects a value sealed with another key', () => {
    const sealed = createSecretBox(key).seal('secret')
    expect(() => createSecretBox(randomBytes(32)).open(sealed)).toThrow()
  })

  it('rejects a tampered or truncated value', () => {
    const box = createSecretBox(key)
    const sealed = box.seal('secret')
    sealed[sealed.length - 1] ^= 0xff
    expect(() => box.open(sealed)).toThrow()
    expect(() => box.open(Buffer.alloc(4))).toThrow(/too short/)
  })
})
