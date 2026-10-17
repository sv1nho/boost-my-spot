import { useLocale } from '../i18n/context.js'

function HelpEn () {
  return (
    <>
      <h3 className='card-title'>Help &amp; FAQ</h3>

      <h4 className='card-title'>Finding your Spotify session key (sp_dc)</h4>
      <p className='card-text'>You need a computer with a desktop browser. On a phone this is much harder.</p>
      <ol className='guide-list'>
        <li>Open <strong>open.spotify.com</strong> in your browser and sign in.</li>
        <li>Open the developer tools (F12), then the <strong>Application</strong> tab.</li>
        <li>Under <strong>Cookies → https://open.spotify.com</strong>, find the row named <strong>sp_dc</strong>.</li>
        <li>Copy its value and paste it into the order form. We never ask for your password.</li>
      </ol>

      <h4 className='card-title'>Common questions</h4>
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

function HelpFr () {
  return (
    <>
      <h3 className='card-title'>Aide et FAQ</h3>

      <h4 className='card-title'>Trouver votre clé de session Spotify (sp_dc)</h4>
      <p className='card-text'>Il vous faut un ordinateur avec un navigateur de bureau. Sur téléphone, c’est bien plus difficile.</p>
      <ol className='guide-list'>
        <li>Ouvrez <strong>open.spotify.com</strong> dans votre navigateur et connectez-vous.</li>
        <li>Ouvrez les outils de développement (F12), puis l’onglet <strong>Application</strong>.</li>
        <li>Dans <strong>Cookies → https://open.spotify.com</strong>, trouvez la ligne <strong>sp_dc</strong>.</li>
        <li>Copiez sa valeur et collez-la dans le formulaire. Nous ne demandons jamais votre mot de passe.</li>
      </ol>

      <h4 className='card-title'>Questions fréquentes</h4>
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
  return <div className='card legal space-y-4'>{locale === 'fr' ? <HelpFr /> : <HelpEn />}</div>
}
