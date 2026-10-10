import { spawn } from 'node:child_process'
import { createReadStream, existsSync } from 'node:fs'
import { loadLocalEnv } from '../server/load-env.js'

loadLocalEnv()

const user = process.env.POSTGRES_USER
const database = process.env.POSTGRES_DB

if (!user || !database) {
  console.error('POSTGRES_USER and POSTGRES_DB must be set in .env')
  process.exit(1)
}

const args = process.argv.slice(2)
const confirmed = args.includes('confirm')
const file = args.find((arg) => arg !== 'confirm')

if (!file) {
  console.error('Usage: npm run db:restore -- <file.sql> confirm')
  process.exit(1)
}

if (!existsSync(file)) {
  console.error(`No such file: ${file}`)
  process.exit(1)
}

if (!confirmed) {
  console.error(
    `Restoring ${file} drops every table in "${database}" and replaces it.\n` +
      'Re-run with `confirm` as the last argument once you are sure.'
  )
  process.exit(1)
}

const restore = spawn(
  'docker',
  [
    'compose', 'exec', '-T', 'postgres',
    'psql', '-v', 'ON_ERROR_STOP=1', '--quiet',
    '-U', user, '-d', database,
  ],
  { stdio: ['pipe', 'inherit', 'inherit'] }
)

createReadStream(file).pipe(restore.stdin)

restore.on('error', (cause: Error) => {
  console.error(`Could not run docker: ${cause.message}`)
  process.exit(1)
})

restore.on('close', (code) => {
  if (code !== 0) {
    console.error(`psql failed with code ${String(code)}. The database may be half-restored.`)
    process.exit(1)
  }

  console.log(`Restored ${database} from ${file}`)
})
