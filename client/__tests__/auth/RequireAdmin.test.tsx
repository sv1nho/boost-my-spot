import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { LocaleProvider } from '../../i18n/context.js'

const useSession = vi.fn<() => { data: unknown; isPending: boolean }>()
vi.mock('../../auth/client.js', () => ({ useSession: () => useSession() }))

const { RequireAdmin } = await import('../../auth/RequireAdmin.js')

const routes = [
  {
    path: '/admin',
    element: <RequireAdmin />,
    children: [{ index: true, element: <div>admin home</div> }],
  },
  { path: '/login', element: <div>login page</div> },
]

const renderAt = (path: string) =>
  render(
    <LocaleProvider>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
    </LocaleProvider>
  )

describe('RequireAdmin', () => {
  it('waits while the session is pending', () => {
    useSession.mockReturnValue({ data: null, isPending: true })
    renderAt('/admin')
    expect(screen.getByText('Checking your session…')).toBeInTheDocument()
  })

  it('redirects to the login page when there is no session', () => {
    useSession.mockReturnValue({ data: null, isPending: false })
    renderAt('/admin')
    expect(screen.getByText('login page')).toBeInTheDocument()
  })

  it('renders the protected content when signed in', () => {
    useSession.mockReturnValue({ data: { user: { email: 'a@b.test' } }, isPending: false })
    renderAt('/admin')
    expect(screen.getByText('admin home')).toBeInTheDocument()
  })
})
