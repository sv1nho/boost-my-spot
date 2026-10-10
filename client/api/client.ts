type ApiErrorDetail = { path: string; message: string }

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: ApiErrorDetail[] | null

  constructor (status: number, code: string, message: string, details: ApiErrorDetail[] | null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  get isUnauthorized (): boolean {
    return this.status === 401
  }

  get isConflict (): boolean {
    return this.status === 409
  }

  messageFor (path: string): string | undefined {
    return this.details?.find((detail) => detail.path === path)?.message
  }
}

export const errorMessage = (cause: unknown): string =>
  cause instanceof ApiError
    ? cause.message
    : 'The server could not be reached. Check your connection and try again.'

export function refusalMessage (cause: unknown, shownByFields: readonly string[] = []): string {
  const details = cause instanceof ApiError ? cause.details : null
  const unplaced = (details ?? []).filter((detail) => !shownByFields.includes(detail.path))

  return unplaced.length === 0 ? errorMessage(cause) : unplaced.map((detail) => detail.message).join(' ')
}

export const isAbort = (cause: unknown): boolean =>
  cause instanceof DOMException && cause.name === 'AbortError'

type ErrorBody = {
  error?: { code?: unknown; message?: unknown; details?: unknown }
}

const detailsOf = (value: unknown): ApiErrorDetail[] | null => {
  if (!Array.isArray(value)) return null

  return value.flatMap((entry) =>
    typeof entry === 'object' &&
    entry !== null &&
    typeof (entry as ApiErrorDetail).path === 'string' &&
    typeof (entry as ApiErrorDetail).message === 'string'
      ? [entry as ApiErrorDetail]
      : []
  )
}

const readBody = async (response: Response): Promise<ErrorBody> => {
  try {
    return (await response.json()) as ErrorBody
  } catch {
    return {}
  }
}

const toApiError = async (response: Response): Promise<ApiError> => {
  const body = await readBody(response)

  const code = typeof body.error?.code === 'string' ? body.error.code : 'UNKNOWN_ERROR'
  const message =
    typeof body.error?.message === 'string' ? body.error.message : `Request failed (${String(response.status)}).`

  return new ApiError(response.status, code, message, detailsOf(body.error?.details))
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | undefined>
  signal?: AbortSignal
}

export function buildUrl (path: string, query: RequestOptions['query']): string {
  if (!query) return path

  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }

  const search = params.toString()
  return search === '' ? path : `${path}?${search}`
}

let asking = 'en'

export function askInLocale (locale: string): void {
  asking = locale
}

export async function request<T> (path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    signal: options.signal,
    headers: {
      'Accept-Language': asking,
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  if (!response.ok) throw await toApiError(response)

  if (response.status === 204) return undefined as T

  return (await response.json()) as T
}
