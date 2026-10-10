type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'VALIDATION_ERROR'
  | 'ILLEGAL_TRANSITION'
  | 'TOO_MANY_REQUESTS'
  | 'INTERNAL_ERROR'

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  VALIDATION_ERROR: 422,
  ILLEGAL_TRANSITION: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
}

export type Vars = Record<string, string | number>

export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly details: unknown
  readonly vars: Vars | undefined

  constructor (code: ErrorCode, message: string, details?: unknown, vars?: Vars) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = STATUS_BY_CODE[code]
    this.details = details
    this.vars = vars
  }
}
