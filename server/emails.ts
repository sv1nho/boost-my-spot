import type { Mail } from './services/mail.js'

type EmailContext = {
  email: string
  reference: string
  trackingLink: string
  locale: string
}

const shell = (heading: string, body: string, cta: string, link: string): string =>
  `<div style="font-family:system-ui,sans-serif;max-width:480px">` +
  `<h2>${heading}</h2><p>${body}</p>` +
  `<p><a href="${link}">${cta}</a></p>` +
  `<p style="color:#888;font-size:12px">boost-my-spot — not affiliated with Spotify AB.</p></div>`

const isFr = (locale: string): boolean => locale === 'fr'

export const orderReceivedEmail = (c: EmailContext): Mail =>
  isFr(c.locale)
    ? {
        to: c.email,
        subject: `Commande reçue — ${c.reference}`,
        html: shell('Commande reçue', `Merci ! Nous avons bien reçu la commande ${c.reference}. Dès que votre paiement est confirmé, nous lançons l’upgrade — suivez-la ici.`, 'Suivre ma commande', c.trackingLink),
        text: `Commande ${c.reference} reçue. Suivez-la : ${c.trackingLink}`,
      }
    : {
        to: c.email,
        subject: `Order received — ${c.reference}`,
        html: shell('Order received', `Thanks! We received order ${c.reference}. As soon as your payment is confirmed we start the upgrade — follow it here.`, 'Track my order', c.trackingLink),
        text: `Order ${c.reference} received. Track it: ${c.trackingLink}`,
      }

export const orderActiveEmail = (c: EmailContext): Mail =>
  isFr(c.locale)
    ? {
        to: c.email,
        subject: `Votre Premium est actif — ${c.reference}`,
        html: shell('Premium activé', `Votre commande ${c.reference} est maintenant Premium. Profitez-en !`, 'Voir ma commande', c.trackingLink),
        text: `Votre commande ${c.reference} est maintenant Premium. ${c.trackingLink}`,
      }
    : {
        to: c.email,
        subject: `Your Premium is active — ${c.reference}`,
        html: shell('Premium active', `Your order ${c.reference} is now Premium. Enjoy!`, 'View my order', c.trackingLink),
        text: `Your order ${c.reference} is now Premium. ${c.trackingLink}`,
      }

export const needsActionEmail = (c: EmailContext): Mail =>
  isFr(c.locale)
    ? {
        to: c.email,
        subject: `Action requise — ${c.reference}`,
        html: shell('Une action est requise', `Nous avons besoin d’une nouvelle clé de session Spotify pour la commande ${c.reference}.`, 'Mettre à jour ma clé', c.trackingLink),
        text: `Une action est requise pour ${c.reference}. ${c.trackingLink}`,
      }
    : {
        to: c.email,
        subject: `Action needed — ${c.reference}`,
        html: shell('We need your session key', `We need a fresh Spotify session key for order ${c.reference}.`, 'Update my key', c.trackingLink),
        text: `Action needed for ${c.reference}. ${c.trackingLink}`,
      }

export const orderFailedEmail = (c: EmailContext): Mail =>
  isFr(c.locale)
    ? {
        to: c.email,
        subject: `Un souci avec votre commande — ${c.reference}`,
        html: shell('Un souci est survenu', `Nous n’avons pas pu finaliser la commande ${c.reference}. Notre équipe revient vers vous.`, 'Voir ma commande', c.trackingLink),
        text: `Un souci avec ${c.reference}. ${c.trackingLink}`,
      }
    : {
        to: c.email,
        subject: `A problem with your order — ${c.reference}`,
        html: shell('Something went wrong', `We could not complete order ${c.reference}. Our team will follow up.`, 'View my order', c.trackingLink),
        text: `A problem with ${c.reference}. ${c.trackingLink}`,
      }
