import { existsSync } from 'node:fs'

export function loadLocalEnv (): void {
  if (existsSync('.env')) process.loadEnvFile()
}
