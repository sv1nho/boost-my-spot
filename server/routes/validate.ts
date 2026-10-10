import type { z } from 'zod'
import { AppError } from '../errors.js'

type Source = 'body' | 'query' | 'params'

const REFUSAL: Record<Source, string> = {
  body: 'Some details were refused. Check the fields marked below.',
  query: 'This search could not be understood.',
  params: 'This address could not be understood.',
}

export function parse<T> (schema: z.ZodType<T>, value: unknown, source: Source): T {
  const result = schema.safeParse(value)

  if (result.success) return result.data

  const details = result.error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }))

  const unplaced = details.find((detail) => detail.path === '')

  throw new AppError('VALIDATION_ERROR', unplaced?.message ?? REFUSAL[source], details)
}
