import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LocaleProvider } from '../../i18n/context.js'
import { Toast } from '../../components/Toast.js'

afterEach(() => { vi.useRealTimers() })

describe('Toast', () => {
  it('shows an undo and a close, and fires their callbacks', async () => {
    const onUndo = vi.fn()
    const onDismiss = vi.fn()
    render(<LocaleProvider><Toast message='Hello' onUndo={onUndo} onDismiss={onDismiss} /></LocaleProvider>)
    expect(screen.getByText('Hello')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onUndo).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onDismiss).toHaveBeenCalled()
  })

  it('dismisses itself after a while', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(<LocaleProvider><Toast message='Bye' onDismiss={onDismiss} /></LocaleProvider>)
    vi.advanceTimersByTime(8000)
    expect(onDismiss).toHaveBeenCalled()
  })
})
