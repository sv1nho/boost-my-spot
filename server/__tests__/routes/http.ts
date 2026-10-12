export type ApiError = {
  error: {
    code: string
    message: string
    details: { path: string; message: string }[] | null
  }
}

export const bodyOf = <T = Record<string, unknown>>(response: { body: unknown }): T =>
  response.body as T
