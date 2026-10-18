import { describe, it, expect } from 'vitest'
import { AppError } from '../errors.js'

describe('AppError', () => {
  it.each([
    ['UNAUTHORIZED', 401],
    ['NOT_FOUND', 404],
    ['CONFLICT', 409],
    ['ILLEGAL_TRANSITION', 409],
    ['VALIDATION_ERROR', 422],
    ['INTERNAL_ERROR', 500],
  ] as const)('maps %s to HTTP %i', (code, status) => {
    expect(new AppError(code, 'message').status).toBe(status)
  })

  it('is an Error, so Express error middleware catches it', () => {
    const error = new AppError('CONFLICT', 'Tracking number already used.')

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('AppError')
    expect(error.message).toBe('Tracking number already used.')
  })

  it('carries optional details', () => {
    expect(new AppError('VALIDATION_ERROR', 'Invalid body.', { field: 'store' }).details)
      .toEqual({ field: 'store' })
    expect(new AppError('VALIDATION_ERROR', 'Invalid body.').details).toBeUndefined()
  })
})
