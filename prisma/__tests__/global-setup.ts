import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { Client } from 'pg'
import { adminDatabaseUrl, testDatabaseName, testDatabaseUrl } from './test-database.js'

const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js')

export default async function setup (): Promise<void> {
  const name = testDatabaseName()
  const admin = new Client({ connectionString: adminDatabaseUrl() })

  await admin.connect()
  try {
    const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])
    if (existing.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${name}"`)
    }
  } finally {
    await admin.end()
  }

  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: 'pipe',
  })
}
