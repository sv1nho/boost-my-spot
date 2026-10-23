import { useLocale } from '../i18n/context.js'

function TermsEn () {
  return (
    <>
      <h3 className='card-title'>Terms of Service</h3>
      <p className='card-text'>boost-my-spot upgrades an existing Spotify account you own to Premium. We are not affiliated with, or endorsed by, Spotify AB.</p>
      <p className='card-text'>Because the service is delivered immediately, you ask us to begin at once and you waive your 14-day right of withdrawal. Payment is made by card (or Apple Pay) and is final once confirmed.</p>
      <p className='card-text'>We provide a lifetime guarantee: if the upgrade stops, request a renewal from your tracking page at no extra cost. If we cannot complete or restore the upgrade, we refund the order.</p>
      <p className='card-text'>You confirm the Spotify account is yours and that you may upgrade it. These terms are a plain-language summary and do not replace advice from a legal professional.</p>
    </>
  )
}

function TermsFr () {
  return (
    <>
      <h3 className='card-title'>Conditions d’utilisation</h3>
      <p className='card-text'>boost-my-spot fait passer en Premium un compte Spotify qui vous appartient déjà. Nous ne sommes pas affiliés à Spotify AB, ni approuvés par cette société.</p>
      <p className='card-text'>Le service étant livré immédiatement, vous nous demandez de commencer tout de suite et vous renoncez à votre droit de rétractation de 14 jours. Le paiement se fait par carte (ou Apple Pay) et est définitif une fois confirmé.</p>
      <p className='card-text'>Nous offrons une garantie à vie : si l’upgrade s’arrête, demandez un renouvellement depuis votre page de suivi, sans frais. Si nous ne pouvons pas finaliser ou rétablir l’upgrade, nous remboursons la commande.</p>
      <p className='card-text'>Vous confirmez que le compte Spotify est le vôtre et que vous pouvez l’améliorer. Ce résumé en langage clair ne remplace pas l’avis d’un professionnel du droit.</p>
    </>
  )
}

export function Terms () {
  const { locale } = useLocale()
  return <div className='card legal space-y-4'>{locale === 'fr' ? <TermsFr /> : <TermsEn />}</div>
}
