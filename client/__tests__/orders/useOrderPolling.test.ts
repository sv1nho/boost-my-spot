import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOrderPolling } from '../../orders/useOrderPolling.js'
import type { OrderView } from '../../../shared/order.js'

vi.mock('../../api/orders.js', () => ({ getOrder: vi.fn() }))
import { getOrder } from '../../api/orders.js'
const getOrderMock = vi.mocked(getOrder)

const order = (status: OrderView['status']): OrderView => ({
  reference: 'BMS-0000ABCD', status, plan: 'lifetime', country: 'US', priceCents: 2000, currency: 'EUR',
  spotifyAccount: null, lastError: null, createdAt: '2026-10-17T10:00:00.000Z', paidAt: null, activatedAt: null,
})

const setHidden = (hidden: boolean): void => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
}

const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0) })
const tick = () => act(async () => { await vi.advanceTimersByTimeAsync(10_000) })

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  setHidden(false)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useOrderPolling', () => {
  it('fetches on mount and reports the first status', async () => {
    getOrderMock.mockResolvedValue(order('paid'))
    const onChange = vi.fn()
    const { result } = renderHook(() => useOrderPolling('tok', onChange))
    await flush()
    expect(result.current.order?.status).toBe('paid')
    expect(onChange).toHaveBeenCalledWith('paid', null)
  })

  it('keeps polling until a settled status, then stops', async () => {
    getOrderMock.mockResolvedValueOnce(order('paid')).mockResolvedValue(order('active'))
    const onChange = vi.fn()
    const { result } = renderHook(() => useOrderPolling('tok', onChange))
    await flush()
    expect(getOrderMock).toHaveBeenCalledTimes(1)
    await tick()
    expect(getOrderMock).toHaveBeenCalledTimes(2)
    expect(result.current.order?.status).toBe('active')
    expect(onChange).toHaveBeenLastCalledWith('active', 'paid')
    await tick()
    expect(getOrderMock).toHaveBeenCalledTimes(2)
  })

  it('skips a tick while the tab is hidden', async () => {
    getOrderMock.mockResolvedValue(order('paid'))
    renderHook(() => useOrderPolling('tok'))
    await flush()
    setHidden(true)
    await tick()
    expect(getOrderMock).toHaveBeenCalledTimes(1)
    setHidden(false)
    await tick()
    expect(getOrderMock).toHaveBeenCalledTimes(2)
  })

  it('surfaces an error and retries', async () => {
    getOrderMock.mockRejectedValueOnce(new Error('down')).mockResolvedValue(order('paid'))
    const { result } = renderHook(() => useOrderPolling('tok'))
    await flush()
    expect(result.current.error).toMatch(/could not be reached/i)
    await tick()
    expect(result.current.order?.status).toBe('paid')
    expect(result.current.error).toBeNull()
  })

  it('ignores an aborted fetch', async () => {
    getOrderMock.mockRejectedValue(new DOMException('aborted', 'AbortError'))
    const { result } = renderHook(() => useOrderPolling('tok'))
    await flush()
    expect(result.current.error).toBeNull()
  })

  it('refetches when reload is called', async () => {
    getOrderMock.mockResolvedValue(order('active'))
    const { result } = renderHook(() => useOrderPolling('tok'))
    await flush()
    expect(getOrderMock).toHaveBeenCalledTimes(1)
    act(() => { result.current.reload() })
    await flush()
    expect(getOrderMock).toHaveBeenCalledTimes(2)
  })

  it('stops polling after unmount', async () => {
    getOrderMock.mockResolvedValue(order('paid'))
    const { unmount } = renderHook(() => useOrderPolling('tok'))
    await flush()
    unmount()
    await tick()
    expect(getOrderMock).toHaveBeenCalledTimes(1)
  })
})
