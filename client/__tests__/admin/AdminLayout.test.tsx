import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { LocaleProvider } from '../../i18n/context.js'

const useSession = vi.fn<() => { data: unknown }>()
const signOut = vi.fn<() => Promise<void>>(() => Promise.resolve())
vi.mock('../../auth/client.js', () => ({ useSession: () => useSession(), signOut: () => signOut() }))

const { AdminLayout } = await import('../../admin/AdminLayout.js')

const routes = [
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [{ index: true, element: <div>orders list</div> }],
  },
  { path: '/login', element: <div>login page</div> },
]

const renderLayout = () =>
  render(
    <LocaleProvider>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/admin'] })} />
    </LocaleProvider>
  )

beforeEach(() => { vi.clearAllMocks() })

describe('AdminLayout', () => {
  it('shows the tabs, the signed-in email and the outlet', () => {
    useSession.mockReturnValue({ data: { user: { email: 'admin@b.test' } } })
    renderLayout()
    expect(screen.getByRole('link', { name: 'Orders' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Keys' })).toBeInTheDocument()
    expect(screen.getByText('admin@b.test')).toBeInTheDocument()
    expect(screen.getByText('orders list')).toBeInTheDocument()
  })

  it('signs out and returns to the login page', async () => {
    useSession.mockReturnValue({ data: null })
    renderLayout()
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(signOut).toHaveBeenCalledOnce()
    expect(await screen.findByText('login page')).toBeInTheDocument()
  })
})
