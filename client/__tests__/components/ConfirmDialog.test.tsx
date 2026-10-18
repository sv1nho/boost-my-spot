import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LocaleProvider } from '../../i18n/context.js'
import { ConfirmDialog } from '../../components/ConfirmDialog.js'

const renderDialog = (overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) => {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <LocaleProvider>
      <ConfirmDialog
        title='Remove it?'
        body='This cannot be undone.'
        confirmLabel='Remove'
        pending={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
        {...overrides}
      />
    </LocaleProvider>
  )
  return { onConfirm, onCancel }
}

describe('ConfirmDialog', () => {
  it('fires confirm and cancel callbacks', async () => {
    const { onConfirm, onCancel } = renderDialog()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('disables the buttons and shows progress while pending', () => {
    renderDialog({ pending: true })
    expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })
})
