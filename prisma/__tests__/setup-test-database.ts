import { testDatabaseUrl } from './test-database.js'

const url = testDatabaseUrl()

if (!new URL(url).pathname.endsWith('_test')) {
  throw new Error(`Refusing to run database tests against ${url}`)
}

process.env.DATABASE_URL = url
