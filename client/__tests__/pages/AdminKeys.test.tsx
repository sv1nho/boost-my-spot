import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LocaleProvider } from '../../i18n/context.js'
import { ApiError } from '../../api/client.js'

vi.mock('../../api/admin.js', () => ({ getKeyStats: vi.fn(), importKeys: vi.fn() }))
import { getKeyStats, importKeys } from '../../api/admin.js'
const statsMock = vi.mocked(getKeyStats)
const importMock = vi.mocked(importKeys)

const { AdminKeys } = await import('../../pages/AdminKeys.js')

const renderPage = () => render(<LocaleProvider><AdminKeys /></LocaleProvider>)

beforeEach(() => {
  vi.clearAllMocks()
  statsMock.mockResolvedValue({ keys: [{ plan: 'lifetime', total: 5, available: 3, used: 2 }] })
})

describe('AdminKeys', () => {
  it('loads then shows the key stats', async () => {
    renderPage()
    expect(screen.getByText('Loading keys…')).toBeInTheDocument()
    const table = await screen.findByRole('table')
    expect(within(table).getByText('Lifetime')).toBeInTheDocument()
    expect(within(table).getByText('3')).toBeInTheDocument()
    expect(within(table).getByText('2')).toBeInTheDocument()
    expect(within(table).getByText('5')).toBeInTheDocument()
  })

  it('imports pasted keys and refreshes the stats', async () => {
    importMock.mockResolvedValue({ imported: 2, skipped: 1 })
    renderPage()
    await screen.findByRole('table')
    await userEvent.selectOptions(screen.getByLabelText('Plan'), 'lifetime')
    await userEvent.type(screen.getByLabelText('Keys'), 'K1\nK2\nK1')
    await userEvent.click(screen.getByRole('button', { name: 'Import keys' }))
    expect(importMock).toHaveBeenCalledWith({ plan: 'lifetime', keys: 'K1\nK2\nK1' })
    expect(await screen.findByText('Imported 2, skipped 1.')).toBeInTheDocument()
    expect(screen.getByLabelText('Keys')).toHaveValue('')
    expect(statsMock).toHaveBeenCalledTimes(2)
  })

  it('keeps the import button disabled until keys are typed', async () => {
    renderPage()
    await screen.findByRole('table')
    expect(screen.getByRole('button', { name: 'Import keys' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Keys'), 'K1')
    expect(screen.getByRole('button', { name: 'Import keys' })).toBeEnabled()
  })

  it('shows an import failure', async () => {
    importMock.mockRejectedValue(new ApiError(422, 'VALIDATION_ERROR', 'Paste at least one key.', null))
    renderPage()
    await screen.findByRole('table')
    await userEvent.type(screen.getByLabelText('Keys'), 'K1')
    await userEvent.click(screen.getByRole('button', { name: 'Import keys' }))
    expect(await screen.findByText('Paste at least one key.')).toBeInTheDocument()
  })

  it('stays loading when the stats request is aborted', async () => {
    statsMock.mockRejectedValue(new DOMException('aborted', 'AbortError'))
    renderPage()
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(screen.getByText('Loading keys…')).toBeInTheDocument()
  })

  it('shows a stats error and retries', async () => {
    statsMock.mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'Down', null))
    renderPage()
    expect(await screen.findByText('Down')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })
})
