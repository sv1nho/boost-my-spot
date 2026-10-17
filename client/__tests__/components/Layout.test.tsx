import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { LocaleProvider } from '../../i18n/context.js'
import { Layout } from '../../components/Layout.js'

const renderLayout = (entry = '/') =>
  render(
    <LocaleProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route element={<Layout />}>
            <Route path='/' element={<p>home marker</p>} />
            <Route path='/order' element={<p>order marker</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </LocaleProvider>
  )

describe('Layout', () => {
  it('renders the shell, nav and footer links', () => {
    renderLayout()
    expect(screen.getByRole('button', { name: /boost-my-spot/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Order' })).toBeInTheDocument()
    expect(screen.getByText(/Not affiliated/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
  })

  it('navigates through the nav and the brand', async () => {
    renderLayout()
    await userEvent.click(screen.getByRole('link', { name: 'Order' }))
    expect(screen.getByText('order marker')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /boost-my-spot/ }))
    expect(screen.getByText('home marker')).toBeInTheDocument()
  })

  it('switches the language', async () => {
    renderLayout()
    const toggle = screen.getByRole('button', { name: /Read this site in Français/ })
    expect(toggle).toHaveTextContent('FR')
    await userEvent.click(toggle)
    expect(screen.getByRole('button', { name: /English/ })).toHaveTextContent('EN')
  })
})
