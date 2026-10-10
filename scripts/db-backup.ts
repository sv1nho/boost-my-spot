import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { pipeline } from 'node:stream/promises'
import { createWriteStream, mkdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { loadLocalEnv } from '../server/load-env.js'

loadLocalEnv()

const user = process.env.POSTGRES_USER
const database = process.env.POSTGRES_DB

if (!user || !database) {
  console.error('POSTGRES_USER and POSTGRES_DB must be set in .env')
  process.exit(1)
}

const stamp = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Brussels',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})
  .format(new Date())
  .replace(' ', '-')
  .replaceAll(':', '')

const directory = 'backups'
mkdirSync(directory, { recursive: true })

const target = join(directory, `boost-my-spot-${stamp}.sql`)

const fail = (message: string): never => {
  console.error(message)
  rmSync(target, { force: true })
  process.exit(1)
}

const dump = spawn(
  'docker',
  [
    'compose', 'exec', '-T', 'postgres',
    'pg_dump', '--clean', '--if-exists', '--no-owner',
    '-U', user, '-d', database,
  ],
  { stdio: ['ignore', 'pipe', 'inherit'] }
)

dump.on('error', (cause: Error) => {
  fail(`Could not run docker: ${cause.message}`)
})

try {
  await pipeline(dump.stdout, createWriteStream(target))
} catch (cause) {
  fail(`Could not write the dump: ${cause instanceof Error ? cause.message : String(cause)}`)
}

const [code] = (await once(dump, 'close')) as [number | null]

if (code !== 0) {
  fail(`pg_dump failed with code ${String(code)}. Is the database running? Try \`npm run db:up\`.`)
}

const { size } = statSync(target)

if (size === 0) {
  fail('pg_dump produced an empty file, refusing to keep it.')
}

console.log(`Wrote ${target} (${Math.round(size / 1024)} KB)`)
