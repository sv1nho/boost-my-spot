import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { LocaleProvider } from '../../i18n/context.js'
import { Home } from '../../pages/Home.js'

const renderHome = () =>
  render(
    <LocaleProvider>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path='/' element={<Home />} />
          <Route path='/order' element={<p>order page</p>} />
          <Route path='/track' element={<p>track page</p>} />
        </Routes>
      </MemoryRouter>
    </LocaleProvider>
  )

describe('Home', () => {
  it('shows the pitch and the steps', () => {
    renderHome()
    expect(screen.getByText('Spotify Premium, upgraded for you')).toBeInTheDocument()
    expect(screen.getByText('How it works')).toBeInTheDocument()
  })

  it('routes to the order and tracking pages', async () => {
    renderHome()
    await userEvent.click(screen.getByRole('button', { name: 'Start an upgrade' }))
    expect(screen.getByText('order page')).toBeInTheDocument()
  })

  it('routes to tracking', async () => {
    renderHome()
    await userEvent.click(screen.getByRole('button', { name: 'Track my order' }))
    expect(screen.getByText('track page')).toBeInTheDocument()
  })
})
