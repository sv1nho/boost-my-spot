import { useState } from 'react'
import { SpotifyKeyGuide } from '../orders/SpotifyKeyGuide.js'
import { useLocale } from '../i18n/context.js'

function HelpEn ({ onGuide }: { onGuide: () => void }) {
  return (
    <>
      <h3 className='card-title'>Help &amp; FAQ</h3>

      <h4 className='card-subtitle'>Finding your Spotify session key (sp_dc)</h4>
      <p className='card-text'>
        You paste one value from your Spotify account — we never ask for your password. A short
        illustrated guide walks you through it in about a minute, on a computer.
      </p>
      <button type='button' className='btn btn-ghost btn-compact' onClick={onGuide}>Open the guide</button>

      <h4 className='card-subtitle'>Common questions</h4>
      <dl className='faq'>
        <dt>Is this official?</dt>
        <dd>No. We are not affiliated with Spotify AB. We upgrade an account you already own.</dd>
        <dt>What if Premium stops later?</dt>
        <dd>Open your tracking page and use the renewal button — it is covered.</dd>
        <dt>Do you store my password?</dt>
        <dd>Never. We only use the session key you paste, and we delete it once your upgrade is done.</dd>
      </dl>
    </>
  )
}

function HelpFr ({ onGuide }: { onGuide: () => void }) {
  return (
    <>
      <h3 className='card-title'>Aide et FAQ</h3>

      <h4 className='card-subtitle'>Trouver votre clé de session Spotify (sp_dc)</h4>
      <p className='card-text'>
        Vous collez une seule valeur depuis votre compte Spotify — nous ne demandons jamais votre
        mot de passe. Un guide illustré vous accompagne en une minute, sur un ordinateur.
      </p>
      <button type='button' className='btn btn-ghost btn-compact' onClick={onGuide}>Ouvrir le guide</button>

      <h4 className='card-subtitle'>Questions fréquentes</h4>
      <dl className='faq'>
        <dt>Est-ce officiel ?</dt>
        <dd>Non. Nous ne sommes pas affiliés à Spotify AB. Nous améliorons un compte qui est déjà le vôtre.</dd>
        <dt>Et si Premium s’arrête plus tard ?</dt>
        <dd>Ouvrez votre page de suivi et utilisez le bouton de renouvellement — c’est garanti.</dd>
        <dt>Stockez-vous mon mot de passe ?</dt>
        <dd>Jamais. Nous n’utilisons que la clé de session que vous collez, et nous la supprimons une fois l’upgrade terminé.</dd>
      </dl>
    </>
  )
}

export function Help () {
  const { locale } = useLocale()
  const [guide, setGuide] = useState(false)
  const openGuide = (): void => { setGuide(true) }

  return (
    <div className='card legal space-y-4'>
      {locale === 'fr' ? <HelpFr onGuide={openGuide} /> : <HelpEn onGuide={openGuide} />}
      {guide && <SpotifyKeyGuide onClose={() => { setGuide(false) }} />}
    </div>
  )
}
