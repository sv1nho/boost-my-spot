import { loadLocalEnv } from '../../server/load-env.js'

loadLocalEnv()

export function testDatabaseUrl (): string {
  const base = process.env.DATABASE_URL

  if (!base) {
    throw new Error('DATABASE_URL must be set to run the database tests')
  }

  const url = new URL(base)
  const name = url.pathname.replace(/^\//, '')

  if (!name) {
    throw new Error(`DATABASE_URL has no database name: ${base}`)
  }

  url.pathname = name.endsWith('_test') ? `/${name}` : `/${name}_test`
  return url.toString()
}

export function adminDatabaseUrl (): string {
  const url = new URL(testDatabaseUrl())
  url.pathname = '/postgres'
  return url.toString()
}

export function testDatabaseName (): string {
  return new URL(testDatabaseUrl()).pathname.replace(/^\//, '')
}
