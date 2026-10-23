import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { Client } from 'pg'
import { adminDatabaseUrl, e2eDatabaseName, e2eDatabaseUrl } from './database.js'

const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js')

const admin = new Client({ connectionString: adminDatabaseUrl() })

await admin.connect()
try {
  const name = e2eDatabaseName()
  const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])

  if (existing.rowCount === 0) await admin.query(`CREATE DATABASE "${name}"`)
} finally {
  await admin.end()
}

execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
  env: { ...process.env, DATABASE_URL: e2eDatabaseUrl() },
  stdio: 'pipe',
})

const database = new Client({ connectionString: e2eDatabaseUrl() })

await database.connect()
try {
  await database.query('TRUNCATE orders, order_events, upgrade_keys, promo_codes, session, account, verification, "user" CASCADE')
} finally {
  await database.end()
}

console.log(`The browser tests will run against ${e2eDatabaseName()}, emptied.`)
