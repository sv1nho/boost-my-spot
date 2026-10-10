import { loadLocalEnv } from '../server/load-env.js'

loadLocalEnv()

export function e2eDatabaseUrl (): string {
  const base = process.env.DATABASE_URL

  if (base === undefined || base === '') {
    throw new Error('DATABASE_URL must be set to run the browser tests')
  }

  const url = new URL(base)
  const name = url.pathname.replace(/^\//, '')

  url.pathname = name.endsWith('_e2e') ? `/${name}` : `/${name}_e2e`

  return url.toString()
}

export function e2eDatabaseName (): string {
  return new URL(e2eDatabaseUrl()).pathname.replace(/^\//, '')
}

export function adminDatabaseUrl (): string {
  const url = new URL(e2eDatabaseUrl())
  url.pathname = '/postgres'

  return url.toString()
}
