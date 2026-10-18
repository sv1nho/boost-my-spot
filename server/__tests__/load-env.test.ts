import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('node:fs', () => ({ existsSync: vi.fn() }))

const { existsSync } = await import('node:fs')
const { loadLocalEnv } = await import('../load-env.js')

afterEach(() => {
  vi.restoreAllMocks()
})

describe('loadLocalEnv', () => {
  it('reads .env when the file is there', () => {
    vi.mocked(existsSync).mockReturnValue(true)
    const load = vi.spyOn(process, 'loadEnvFile').mockImplementation(() => {})

    loadLocalEnv()

    expect(load).toHaveBeenCalledOnce()
  })

  it('does nothing without a .env, the situation in CI and in production', () => {
    vi.mocked(existsSync).mockReturnValue(false)
    const load = vi.spyOn(process, 'loadEnvFile').mockImplementation(() => {})

    expect(() => { loadLocalEnv() }).not.toThrow()
    expect(load).not.toHaveBeenCalled()
  })
})
