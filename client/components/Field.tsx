import type { ReactNode } from 'react'

type FieldProps = {
  label: string
  htmlFor: string
  problem: string | undefined
  hint?: string
  hideLabel?: boolean
  children: ReactNode
}

export function Field (
  { label, htmlFor, problem, hint, hideLabel = false, children }: FieldProps
) {
  return (
    <div className='form-field'>
      <label className={hideLabel ? 'sr-only' : 'form-label'} htmlFor={htmlFor}>{label}</label>
      {children}
      {hint !== undefined && <p className='field-hint' id={`${htmlFor}-hint`}>{hint}</p>}
      {problem !== undefined && <p className='field-error' id={`${htmlFor}-error`}>{problem}</p>}
    </div>
  )
}

type Marks = {
  className: string
  'aria-invalid'?: true
  'aria-describedby'?: string
}

export const fieldMarks = (
  htmlFor: string,
  problem: string | undefined,
  hint?: string
): Marks => {
  const describedBy = [
    hint === undefined ? '' : `${htmlFor}-hint`,
    problem === undefined ? '' : `${htmlFor}-error`,
  ].filter((id) => id !== '').join(' ')

  return {
    className: problem === undefined ? 'form-input' : 'form-input form-input-invalid',
    ...(problem === undefined ? {} : { 'aria-invalid': true as const }),
    ...(describedBy === '' ? {} : { 'aria-describedby': describedBy }),
  }
}
