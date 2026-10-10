import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import semver from 'semver'

type Where = 'production' | 'tooling'

type Advisory = {
  name: string
  severity: string
  vulnerable: string
  where: Where
}

type Outcome = {
  advisory: Advisory
  done: string
  detail: string
  fixed: boolean
}

type Manifest = {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  overrides?: Record<string, string>
}

type Lockfile = {
  packages: Record<string, {
    version?: string
    dependencies?: Record<string, string>
    optionalDependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
  }>
}

type Packument = {
  versions: Record<string, {
    dependencies?: Record<string, string>
    optionalDependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
  }>
}

const PRODUCTION_FLAGS = ['--omit=dev', '--omit=optional']

const BLOCKING = new Set(['high', 'critical'])

const PLAIN_ARGUMENT = /^[@a-zA-Z0-9._/=-]+$/

const npm = (args: string[]): string => {
  const odd = args.find((argument) => !PLAIN_ARGUMENT.test(argument))

  if (odd !== undefined) throw new Error(`Refusing to hand npm an argument like ${odd}`)

  try {
    return execSync(`npm ${args.join(' ')}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    return (error as { stdout?: string }).stdout ?? ''
  }
}

const manifest = (): Manifest => JSON.parse(readFileSync('package.json', 'utf8')) as Manifest

const wholeManifest = (): Record<string, unknown> =>
  JSON.parse(readFileSync('package.json', 'utf8')) as Record<string, unknown>

const lockfile = (): Lockfile => JSON.parse(readFileSync('package-lock.json', 'utf8')) as Lockfile

const writeManifest = (next: Record<string, unknown>): void => {
  writeFileSync('package.json', `${JSON.stringify(next, null, 2)}\n`)
  npm(['install', '--package-lock-only'])
}

const auditOf = (flags: string[]): Record<string, { severity: string; range: string }> => {
  const output = npm(['audit', '--json', ...flags])

  try {
    const parsed = JSON.parse(output) as {
      vulnerabilities?: Record<string, { severity: string; range: string }>
    }

    return parsed.vulnerabilities ?? {}
  } catch {
    throw new Error(
      `npm audit --json ${flags.join(' ')} answered something unreadable, ` +
      `so nothing here can be trusted:\n${output.slice(0, 400)}`
    )
  }
}

const listAdvisories = (): Advisory[] => {
  const everywhere = auditOf([])
  const inProduction = auditOf(PRODUCTION_FLAGS)

  return Object.entries(everywhere).map(([name, found]) => ({
    name,
    severity: found.severity,
    vulnerable: found.range,
    where: name in inProduction ? 'production' : 'tooling',
  }))
}

const packuments = new Map<string, Packument | null>()

const packumentOf = async (name: string): Promise<Packument | null> => {
  const known = packuments.get(name)

  if (known !== undefined) return known

  const response = await fetch(`https://registry.npmjs.org/${name}`)
  const fetched = response.ok ? await response.json() as Packument : null

  packuments.set(name, fetched)

  return fetched
}

const nameOf = (path: string): string => path.split('node_modules/').at(-1) ?? path

const installedVersion = (name: string): string | null => {
  const { packages } = lockfile()
  const hoisted = packages[`node_modules/${name}`]

  if (hoisted !== undefined) return hoisted.version ?? null

  const nested = Object.entries(packages).find(([path]) => path !== '' && nameOf(path) === name)

  return nested?.[1].version ?? null
}

const safeVersions = async (name: string, vulnerable: string): Promise<string[]> => {
  const packument = await packumentOf(name)

  if (packument === null) return []

  return Object.keys(packument.versions)
    .filter((version) => semver.valid(version) !== null && semver.prerelease(version) === null)
    .filter((version) => !semver.satisfies(version, vulnerable))
    .sort(semver.compare)
}

const nearest = (versions: string[], installed: string | null): string | null => {
  const forward = installed === null
    ? versions
    : versions.filter((version) => semver.gte(version, installed))

  return forward.at(0) ?? versions.at(-1) ?? null
}

const parentsOf = (name: string): { name: string; wants: string; direct: boolean }[] => {
  const declared = { ...manifest().dependencies, ...manifest().devDependencies }
  const found = new Map<string, { name: string; wants: string; direct: boolean }>()

  for (const [path, entry] of Object.entries(lockfile().packages)) {
    if (path === '') continue

    const wants = entry.dependencies?.[name] ??
      entry.optionalDependencies?.[name] ??
      entry.peerDependencies?.[name]

    if (wants === undefined) continue

    const parent = nameOf(path)

    found.set(parent, { name: parent, wants, direct: parent in declared })
  }

  return [...found.values()]
}

const safeVersion = async (
  name: string,
  vulnerable: string,
  parents: { wants: string }[]
): Promise<string | null> => {
  const safe = await safeVersions(name, vulnerable)
  const agreed = safe.filter((version) => parents.every((one) => semver.satisfies(version, one.wants)))
  const installed = installedVersion(name)

  return nearest(agreed, installed) ?? nearest(safe, installed)
}

const smallestAccepting = async (
  parent: string,
  dependency: string,
  wanted: string
): Promise<string | null> => {
  const packument = await packumentOf(parent)
  const current = installedVersion(parent)

  if (packument === null || current === null) return null

  const candidates = Object.entries(packument.versions)
    .filter(([version]) => semver.valid(version) !== null && semver.prerelease(version) === null)
    .filter(([version]) => semver.gt(version, current))
    .sort(([a], [b]) => semver.compare(a, b))

  for (const [version, published] of candidates) {
    const range = published.dependencies?.[dependency] ??
      published.optionalDependencies?.[dependency] ??
      published.peerDependencies?.[dependency]

    if (range !== undefined && semver.satisfies(wanted, range)) return version
  }

  return null
}

const isMajorStep = (name: string, target: string): boolean => {
  const current = installedVersion(name)

  return current !== null && semver.major(target) !== semver.major(current)
}

const addOverride = (name: string, version: string): void => {
  const whole = wholeManifest()
  const overrides = { ...(whole.overrides as Record<string, string> | undefined), [name]: version }

  whole.overrides = Object.fromEntries(Object.entries(overrides).sort())
  writeManifest(whole)
}

const removeOverrides = (names: string[]): void => {
  const stays = Object.entries(manifest().overrides ?? {}).filter(([name]) => !names.includes(name))
  const whole = wholeManifest()

  whole.overrides = stays.length === 0 ? undefined : Object.fromEntries(stays)
  writeManifest(whole)
}

const dropStaleOverrides = (): { name: string; forced: string }[] => {
  const stale = Object.entries(manifest().overrides ?? {}).filter(([name, forced]) => {
    const parents = parentsOf(name)

    return parents.length > 0 && parents.every((parent) => semver.satisfies(forced, parent.wants))
  })

  if (stale.length === 0) return []

  removeOverrides(stale.map(([name]) => name))

  return stale.map(([name, forced]) => ({ name, forced }))
}

const reconsiderOverride = (
  advisory: Advisory,
  wanted: string,
  parents: { wants: string }[],
  forced: string
): Omit<Outcome, 'fixed'> => {
  if (parents.every((parent) => semver.satisfies(wanted, parent.wants))) {
    removeOverrides([advisory.name])

    return {
      advisory,
      done: 'override dropped',
      detail: `it pinned ${forced}, which carries the advisory, and every parent takes ${wanted} on its own`,
    }
  }

  addOverride(advisory.name, wanted)

  return { advisory, done: 'override raised', detail: `from ${forced} to ${wanted}` }
}

const treatDirect = (advisory: Advisory, wanted: string): Omit<Outcome, 'fixed'> => {
  const current = installedVersion(advisory.name) ?? 'unknown'
  const major = isMajorStep(advisory.name, wanted)
  const step = `${advisory.name} ${current} → ${wanted}`

  if (major && advisory.where === 'tooling') {
    return {
      advisory,
      done: 'left alone',
      detail: `it is a direct dependency and the only way out is ${step}, a major step. ` +
        `Run \`npm install ${advisory.name}@${wanted}\` if you want it`,
    }
  }

  npm(['install', `${advisory.name}@${wanted}`, '--package-lock-only', '--save-exact'])

  return { advisory, done: 'bumped', detail: `${step}${major ? ', a major step' : ''}` }
}

const treat = async (advisory: Advisory): Promise<Omit<Outcome, 'fixed'>> => {
  const parents = parentsOf(advisory.name)
  const wanted = await safeVersion(advisory.name, advisory.vulnerable, parents)

  if (wanted === null) {
    return { advisory, done: 'left alone', detail: 'no published version of it is free of the advisory' }
  }

  const forced = manifest().overrides?.[advisory.name]

  if (forced !== undefined) return reconsiderOverride(advisory, wanted, parents, forced)

  const declared = { ...manifest().dependencies, ...manifest().devDependencies }

  if (advisory.name in declared) return treatDirect(advisory, wanted)

  const refusing = parents.filter((parent) => !semver.satisfies(wanted, parent.wants))

  if (refusing.length === 0) {
    npm(['update', advisory.name, '--package-lock-only'])

    return { advisory, done: 'updated', detail: `every parent already accepts ${wanted}` }
  }

  const bumped: string[] = []
  const stuck: string[] = []

  for (const parent of refusing) {
    const smallest = parent.direct ? await smallestAccepting(parent.name, advisory.name, wanted) : null

    if (smallest === null) {
      stuck.push(`${parent.name} wants ${parent.wants}`)
      continue
    }

    if (isMajorStep(parent.name, smallest) && advisory.where === 'tooling') {
      stuck.push(`${parent.name} would need a major step to ${smallest}`)
      continue
    }

    npm(['install', `${parent.name}@${smallest}`, '--package-lock-only', '--save-exact'])
    bumped.push(`${parent.name} → ${smallest}`)
  }

  if (stuck.length === 0) {
    npm(['update', advisory.name, '--package-lock-only'])

    return { advisory, done: 'bumped', detail: `through its parents: ${bumped.join(', ')}` }
  }

  if (advisory.where === 'tooling') {
    return {
      advisory,
      done: 'left alone',
      detail: `${stuck.join('; ')}. An override would reach production too, so this one waits for upstream`,
    }
  }

  addOverride(advisory.name, wanted)

  return { advisory, done: 'overridden', detail: `forced to ${wanted} because ${stuck.join('; ')}` }
}

const verdict = (left: Advisory[]): string[] => {
  if (left.length === 0) return ['## Verdict', '', 'Both audits are clean now.', '']

  const blocking = left
    .filter((one) => one.where === 'production' && BLOCKING.has(one.severity))
    .map((one) => one.name)

  return [
    '## Verdict',
    '',
    blocking.length === 0
      ? `${String(left.length)} advisories are still open, none of them blocking: ` +
        'the pipeline gate only fails on a high or critical advisory that production ships.'
      : `The pipeline gate will still fail on ${blocking.join(', ')}.`,
    '',
  ]
}

const report = (
  outcomes: Outcome[],
  dropped: { name: string; forced: string }[],
  opened: number,
  left: Advisory[]
): string => {
  const lines: string[] = []

  const section = (title: string, where: Where): void => {
    const rows = outcomes.filter((outcome) => outcome.advisory.where === where)

    lines.push(`## ${title}`, '')

    if (rows.length === 0) {
      lines.push('Nothing was open on this side.', '')
      return
    }

    lines.push('| Package | Severity | Still open | What happened |', '| --- | --- | --- | --- |')

    for (const { advisory, done, detail, fixed } of rows) {
      lines.push(`| \`${advisory.name}\` | ${advisory.severity} | ${fixed ? 'no' : '**yes**'} | ${done} — ${detail} |`)
    }

    lines.push('')
  }

  lines.push(`${String(opened)} advisories were open when this ran.`, '')
  section('Production', 'production')
  section('Tooling', 'tooling')

  if (dropped.length > 0) {
    lines.push(
      '## Overrides dropped',
      '',
      ...dropped.map(({ name, forced }) => `- \`${name}@${forced}\`, every parent accepts it now`),
      ''
    )
  }

  lines.push(...verdict(left))

  return lines.join('\n')
}

const opened = listAdvisories()

if (opened.length === 0) {
  writeFileSync('advisories.md', 'No advisory is open.\n')
  console.log('No advisory is open.')
  process.exit(0)
}

npm(['audit', 'fix', '--package-lock-only'])

const letGo = dropStaleOverrides()
const afterNpmFix = listAdvisories()
const acted: Omit<Outcome, 'fixed'>[] = []

for (const advisory of opened) {
  const still = afterNpmFix.find((one) => one.name === advisory.name)

  if (still === undefined) {
    acted.push({ advisory, done: 'fixed', detail: 'npm audit fix settled it' })
    continue
  }

  acted.push(await treat(still))
}

const left = listAdvisories()
const forcedAgain = manifest().overrides ?? {}
const dropped = letGo.filter(({ name }) => !(name in forcedAgain))

const outcomes: Outcome[] = acted.map((outcome) => {
  const fixed = !left.some((one) => one.name === outcome.advisory.name)

  return fixed && outcome.done === 'left alone'
    ? { ...outcome, done: 'fixed', detail: 'another change in this run took it along', fixed }
    : { ...outcome, fixed }
})

const written = report(outcomes, dropped, opened.length, left)

writeFileSync('advisories.md', `${written}\n`)
console.log(written)
