export const parseAdminEmails = (raw: string | undefined): Set<string> =>
  new Set(
    (raw ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0)
  )

export const isAdminEmail = (email: string, admins: Set<string>): boolean =>
  admins.has(email.trim().toLowerCase())
