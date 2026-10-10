import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const BUDGET_KB = 185
const BUILD = join('dist', 'web')

const html = readFileSync(join(BUILD, 'index.html'), 'utf8')

const firstLoad = [...html.matchAll(/(?:src|href)="\/([^"]+\.js)"/g)].map((match) => match[1])

if (firstLoad.length === 0) {
  console.error('No script found in the built index.html. Run `npm run build` first.')
  process.exit(1)
}

const weighed = firstLoad.map((file) => ({
  file,
  kb: gzipSync(readFileSync(join(BUILD, file))).byteLength / 1024,
}))

const total = weighed.reduce((sum, entry) => sum + entry.kb, 0)

for (const { file, kb } of weighed.sort((a, b) => b.kb - a.kb)) {
  console.log(`${kb.toFixed(1).padStart(7)} kB  ${file}`)
}

console.log(`${total.toFixed(1).padStart(7)} kB  first load, gzipped (budget ${String(BUDGET_KB)} kB)`)

if (total > BUDGET_KB) {
  console.error(
    `\nThe first load grew past its budget by ${(total - BUDGET_KB).toFixed(1)} kB. ` +
    'Load the new code with a dynamic import, or raise the budget on purpose.'
  )
  process.exit(1)
}
