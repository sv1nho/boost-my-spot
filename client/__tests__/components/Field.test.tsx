import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Field, fieldMarks } from '../../components/Field.js'

describe('Field', () => {
  it('shows the label, hint and error when given', () => {
    render(
      <Field label='Email' htmlFor='x' problem='Bad email' hint='We email you'>
        <input id='x' />
      </Field>
    )
    expect(screen.getByText('Email')).toHaveClass('form-label')
    expect(screen.getByText('We email you')).toHaveAttribute('id', 'x-hint')
    expect(screen.getByText('Bad email')).toHaveAttribute('id', 'x-error')
  })

  it('hides the label and omits hint and error when asked', () => {
    render(
      <Field label='Hidden' htmlFor='y' problem={undefined} hideLabel>
        <input id='y' />
      </Field>
    )
    expect(screen.getByText('Hidden')).toHaveClass('sr-only')
    expect(screen.queryByText(/./, { selector: '.field-hint' })).toBeNull()
    expect(screen.queryByText(/./, { selector: '.field-error' })).toBeNull()
  })
})

describe('fieldMarks', () => {
  it('is plain when there is no problem', () => {
    expect(fieldMarks('a', undefined)).toEqual({ className: 'form-input' })
  })

  it('points at the hint when there is one', () => {
    expect(fieldMarks('a', undefined, 'a hint')).toEqual({ className: 'form-input', 'aria-describedby': 'a-hint' })
  })

  it('marks invalid and points at both hint and error', () => {
    expect(fieldMarks('a', 'oops', 'a hint')).toEqual({
      className: 'form-input form-input-invalid',
      'aria-invalid': true,
      'aria-describedby': 'a-hint a-error',
    })
  })
})
