import { describe, it, expect } from 'vitest'
import { parseAdminEmails, isAdminEmail } from '../../auth/admin-emails.js'

describe('parseAdminEmails', () => {
  it('splits, trims and lowercases a comma-separated list', () => {
    const admins = parseAdminEmails(' Admin@Example.com , ops@example.com ')
    expect([...admins]).toEqual(['admin@example.com', 'ops@example.com'])
  })

  it('drops empty entries and returns an empty set for nothing', () => {
    expect([...parseAdminEmails('a@b.test,, ,')]).toEqual(['a@b.test'])
    expect([...parseAdminEmails(undefined)]).toEqual([])
    expect([...parseAdminEmails('')]).toEqual([])
  })
})

describe('isAdminEmail', () => {
  const admins = parseAdminEmails('admin@example.com')

  it('matches regardless of case and surrounding spaces', () => {
    expect(isAdminEmail('  ADMIN@example.com ', admins)).toBe(true)
  })

  it('rejects an email that is not listed', () => {
    expect(isAdminEmail('someone@else.com', admins)).toBe(false)
  })
})
