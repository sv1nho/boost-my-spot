import { useState } from 'react'
import { Field, fieldMarks } from '../components/Field.js'
import { useT } from '../i18n/context.js'

type Props = {
  id: string
  value: string
  problem: string | undefined
  onChange: (value: string) => void
}

export function SpotifyKeyField ({ id, value, problem, onChange }: Props) {
  const t = useT()
  const [shown, setShown] = useState(false)
  const hint = t('Paste the value of your Spotify "sp_dc" cookie. The help page shows where to find it.')
  const marks = fieldMarks(id, problem, hint)

  return (
    <Field label={t('Spotify session key')} htmlFor={id} problem={problem} hint={hint}>
      <div className='key-field'>
        <input
          {...marks}
          id={id}
          type={shown ? 'text' : 'password'}
          autoComplete='off'
          spellCheck={false}
          value={value}
          onChange={(event) => { onChange(event.target.value) }}
        />
        <button
          type='button'
          className='btn btn-ghost btn-compact'
          onClick={() => { setShown((previous) => !previous) }}
        >
          {shown ? t('Hide') : t('Show')}
        </button>
      </div>
    </Field>
  )
}
