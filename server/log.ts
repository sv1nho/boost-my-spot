import { isProduction } from './env.js'

type Level = 'info' | 'warn' | 'error'

type Fields = Record<string, string | number | boolean | null | undefined>

const told = (fields: Fields): [string, string | number | boolean][] =>
  Object.entries(fields).filter(
    (entry): entry is [string, string | number | boolean] =>
      entry[1] !== undefined && entry[1] !== null
  )

const asJson = (level: Level, message: string, fields: Fields): string =>
  JSON.stringify({ time: new Date().toISOString(), level, message, ...fields })

const asLine = (level: Level, message: string, fields: Fields): string =>
  [level.toUpperCase(), message, ...told(fields).map(([key, value]) => `${key}=${String(value)}`)]
    .join(' ')

export const log = (level: Level, message: string, fields: Fields = {}): void => {
  const written = isProduction ? asJson(level, message, fields) : asLine(level, message, fields)
  const stream = level === 'error' ? process.stderr : process.stdout

  stream.write(`${written}\n`)
}
