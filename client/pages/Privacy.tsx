import { useLocale } from '../i18n/context.js'

function PrivacyEn () {
  return (
    <>
      <h3 className='card-title'>Privacy</h3>
      <p className='card-text'>We collect only what the order needs: your email, your chosen country, and the Spotify session key you paste.</p>
      <p className='card-text'>The session key is encrypted at rest, never logged, and deleted as soon as the upgrade no longer needs it. We never ask for, or store, your Spotify password.</p>
      <p className='card-text'>Your email is used to send your order number and status updates. Payment is handled by our payment provider; we never see or store your card details.</p>
      <p className='card-text'>To have your data removed, contact us with your order number. This summary does not replace advice from a legal professional.</p>
    </>
  )
}

function PrivacyFr () {
  return (
    <>
      <h3 className='card-title'>Confidentialité</h3>
      <p className='card-text'>Nous ne collectons que ce dont la commande a besoin : votre e-mail, le pays choisi et la clé de session Spotify que vous collez.</p>
      <p className='card-text'>La clé de session est chiffrée au repos, jamais journalisée, et supprimée dès que l’upgrade n’en a plus besoin. Nous ne demandons ni ne stockons jamais votre mot de passe Spotify.</p>
      <p className='card-text'>Votre e-mail sert à envoyer votre numéro de commande et les mises à jour de statut. Le paiement est géré par notre prestataire de paiement ; nous ne voyons ni ne stockons jamais vos informations de carte.</p>
      <p className='card-text'>Pour faire supprimer vos données, contactez-nous avec votre numéro de commande. Ce résumé ne remplace pas l’avis d’un professionnel du droit.</p>
    </>
  )
}

export function Privacy () {
  const { locale } = useLocale()
  return <div className='card legal space-y-4'>{locale === 'fr' ? <PrivacyFr /> : <PrivacyEn />}</div>
}
