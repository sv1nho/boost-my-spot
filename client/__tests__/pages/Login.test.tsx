import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { LocaleProvider } from '../../i18n/context.js'

const useSession = vi.fn<() => { data: unknown; isPending: boolean }>()
const social = vi.fn<(options: unknown) => Promise<{ error?: { message?: string } }>>()
vi.mock('../../auth/client.js', () => ({
  useSession: () => useSession(),
  signIn: { social: (options: unknown) => social(options) },
}))

const { Login } = await import('../../pages/Login.js')

const routes = [
  { path: '/login', element: <Login /> },
  { path: '/admin', element: <div>admin area</div> },
]

const renderAt = (path = '/login') =>
  render(
    <LocaleProvider>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
    </LocaleProvider>
  )

const config = (providers: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: () => Promise.resolve({ providers }) } as unknown as Response)

beforeEach(() => { vi.clearAllMocks(); useSession.mockReturnValue({ data: null, isPending: false }) })
afterEach(() => { vi.restoreAllMocks() })

describe('Login', () => {
  it('waits while the session is pending', () => {
    config(['google'])
    useSession.mockReturnValue({ data: null, isPending: true })
    renderAt()
    expect(screen.getByText('Checking your session…')).toBeInTheDocument()
  })

  it('redirects to the back-office when already signed in', async () => {
    config(['google'])
    useSession.mockReturnValue({ data: { user: { email: 'a@b.test' } }, isPending: false })
    renderAt()
    expect(await screen.findByText('admin area')).toBeInTheDocument()
  })

  it('signs in with the configured provider', async () => {
    config(['google'])
    social.mockResolvedValue({})
    renderAt()
    const button = await screen.findByRole('button', { name: 'Continue with Google' })
    await userEvent.click(button)
    expect(social).toHaveBeenCalledWith(expect.objectContaining({ provider: 'google', callbackURL: '/admin' }))
    expect(await screen.findByText('Redirecting…')).toBeInTheDocument()
  })

  it('shows an error when sign-in is refused', async () => {
    config(['google'])
    social.mockResolvedValue({ error: { message: 'no good' } })
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Continue with Google' }))
    expect(await screen.findByText('no good')).toBeInTheDocument()
  })

  it('shows a fallback message when sign-in fails without a message', async () => {
    config(['google'])
    social.mockResolvedValue({ error: {} })
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Continue with Google' }))
    expect(await screen.findByText('Sign-in failed, please try again.')).toBeInTheDocument()
  })

  it('reports when no provider is configured', async () => {
    config([])
    renderAt()
    expect(await screen.findByText('No sign-in provider is configured on this server.')).toBeInTheDocument()
  })

  it('treats a non-array config as no providers', async () => {
    config(null)
    renderAt()
    expect(await screen.findByText('No sign-in provider is configured on this server.')).toBeInTheDocument()
  })

  it('shows the cancelled notice from the oauth error param', async () => {
    config(['google'])
    renderAt('/login?error=oauth')
    expect(await screen.findByText('Sign-in was cancelled or refused. You can try again.')).toBeInTheDocument()
  })

  it('reports no providers when the config request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    renderAt()
    expect(await screen.findByText('No sign-in provider is configured on this server.')).toBeInTheDocument()
  })

  it('stays quiet when the config request is aborted', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('aborted', 'AbortError'))
    renderAt()
    expect(await screen.findByText('Loading sign-in options…')).toBeInTheDocument()
  })
})
