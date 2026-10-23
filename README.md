# boost-my-spot

Upgrades an existing Spotify account to Premium on a customer's behalf, and lets
them follow that upgrade to completion. Guest checkout, no customer account.
React + Vite on the front, Express + Prisma + PostgreSQL on the back.

> Not affiliated with, or endorsed by, Spotify AB. "Spotify" is a trademark of
> its owner.

## What it does

A visitor picks a plan and a country, pastes their Spotify session key (we never
ask for a password), pays by card or Apple Pay, and gets an order reference. A background
worker runs the upgrade through the reseller API and moves the order through
`awaiting_payment → paid → upgrading → active`. The visitor follows it on a
tracking page that refreshes itself, and gets the same by email. If the session
key is rejected, or Premium later stops, they fix it themselves from the tracking
page — a fresh key, or a self-service renewal.

A small **back-office** sits behind Google sign-in: the orders queue sorted by
urgency, a per-order view with its history and the actions (relaunch, confirm a
payment, mark refunded), and upgrade-key stock with a paste-to-import form.

## Repository layout

| Path | What lives there |
|---|---|
| `client/` | React app: pages, routing, i18n, the single stylesheet |
| `server/` | Express API: app factory, middleware, auth, services, the worker |
| `shared/` | Types and pure logic used by both sides (plans, statuses, transitions) |
| `prisma/` | Schema, migrations, database tests |
| `e2e/` | Playwright journeys and their database setup |
| `scripts/` | Bundle budget, advisories, backups, and the local fake upstream |

The services in `server/services/` are factories — `createX({ fetch, … })` — so
they take their collaborators as arguments and test without reaching the network.
`server/deps.ts` is the one place that reads the environment and wires them
together; `server/worker/` drains the order queue on a 5-second tick.

## Local setup

Requires Node 24 or newer, and Docker.

```sh
cp .env.example .env            # then fill POSTGRES_PASSWORD and BETTER_AUTH_SECRET
npm install                     # also generates the Prisma client
npm run db:up                   # Postgres in Docker, host port 5434
npm run db:deploy               # apply migrations
npm run dev                     # client 5174, api 3001, fake upstream 3199
```

`npm run dev` runs three processes together: the Vite client, the API (watched),
and `scripts/fake-upstream.ts` — a stand-in for upgrader.cc, NOWPayments and
Resend. `.env.example` points the three upstream URLs at it, so a fresh checkout
runs a whole order end to end without any real keys: the fake signs its own IPN,
calls the webhook back, and records the emails it is sent. Ports are shifted from
ShipBox (Postgres 5434, API 3001, web 5174, fake upstream 3199) so the two
projects run side by side.

The client calls `/api` on its own origin; the Vite dev proxy forwards to the
API, which avoids CORS and cross-origin cookies in development.

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | client, api and fake upstream together, watched |
| `npm run dev:web` / `dev:api` / `dev:fake` | any one on its own |
| `npm run build` | `dist/web` (served) and `dist/api` (compiled server) |
| `npm start` | run the compiled server the way production does, no transpiler |
| `npm test` | client + server + db suites, with 100% coverage thresholds |
| `npm run fuzz` | throws generated hostile bodies and queries at every route |
| `npm run e2e` | drives a real browser through the journeys, against a real database |
| `npm run lint` / `typecheck` / `knip` | the static gates |
| `npm run size` | weighs the first page load against a budget |
| `npm run db:up` / `db:down` | the PostgreSQL container |
| `npm run db:migrate` / `db:deploy` | create-and-apply, or apply-only, migrations |
| `npm run db:check` | applies migrations, then fails if the schema has drifted |
| `npm run db:reset` | **drops the development database** and replays every migration |
| `npm run db:studio` | the Prisma database browser |
| `npm run db:backup` / `db:restore` | dump to `backups/`, and restore one |
| `npm run advisories` | the smallest bump that closes each npm advisory, into `advisories.md` |

A production install is `npm ci --omit=dev --omit=optional --ignore-scripts`,
then `npm run build` and `npm start` on top of it. The browser libraries live in
`devDependencies` because Vite bundles them into `dist/web` and the Node process
never imports them; `--omit=optional` keeps the test toolchain (declared as Better
Auth optional peers) off the server; `--ignore-scripts` stops `postinstall` from
running the Prisma CLI there — the build does that step instead. `dist/web` is the
only tree the API serves; `dist/api` sits outside `express.static`, and `npm start`
runs it with plain Node. CI installs exactly this way, boots the result and calls
`/api/health`, so the path cannot rot unnoticed.

### Container

`docker build -t boost-my-spot .`, then run it with `--env-file .env`. The build
is two stages pinned by digest: the first installs everything and builds, the
runtime stage keeps only the production tree and `dist`, runs as the unprivileged
`node` user, and binds `0.0.0.0` so it is reachable from outside the container.
Migrations are **not** in the image — `prisma migrate deploy` needs the Prisma CLI
and `prisma.config.ts`, both toolchain, so run `npm run db:deploy` from a release
step before rolling a new image out.

## The order lifecycle and the session key

An order moves through a small state machine, defined once as an adjacency table
in `shared/transitions.ts` and enforced on every write with a conditional
`UPDATE … WHERE status = $from`, so concurrent workers cannot double-apply a step:

```
awaiting_payment → paid | expired | underpaid
expired          → paid                       (a late payment)
underpaid        → paid (admin) | refunded
paid             → upgrading | needs_action | failed
upgrading        → active | needs_action | failed | paid (retry)
needs_action     → paid (new key) | refunded
active           → renewing (warranty)
renewing         → active | needs_action | failed
failed           → paid (admin relaunch) | refunded
```

The Spotify `sp_dc` session key is treated as a password. It is sealed at rest
with AES-256-GCM (`server/services/secret-box.ts`), never logged, and the
database itself **refuses to keep it** once it is no longer needed: a `CHECK`
constraint allows `sp_dc_sealed` to be non-null only while the status is one of
`awaiting_payment`, `paid`, `upgrading` or `renewing`. Reaching any other status
clears it in the same transaction.

The tracking link is stateless: `id.hmac(id)`, verified in constant time and
never stored, so there is no session for a guest to lose. Order references are
`BMS-` plus eight Crockford-base32 characters.

## The upgrade API and payments

The upgrade runs through the upgrader.cc reseller API, authenticated per request
with the customer's `sp_dc` cookie (password login is not supported upstream, and
OAuth only yields a Web-API token, not the cookie). Every upstream reply is parsed
with Zod and failures are classified — `cookie_rejected`, `out_of_stock`,
`rate_limited`, `transient`, `rejected` — so an unknown shape fails cleanly instead
of producing a false state. A 429 is honoured by its `retry_after`.

Payments go through NOWPayments, behind a `PaymentProvider` seam. The customer
pays **by card, Apple Pay or Google Pay** on NOWPayments' hosted page — its fiat
on-ramp (Banxa/Guardarian) takes the card and settles to the merchant in crypto,
so the card-processing risk sits with the regulated on-ramp partner rather than a
merchant account of ours. The invoice is created in EUR with a fiat `pay_currency`
to route to the on-ramp; everything else (the redirect and the IPN) is unchanged.
The IPN webhook is mounted before the JSON body parser and read raw: its
HMAC-SHA512 signature is checked over the JSON with keys sorted deeply, and the
amount and currency are matched against the order before it is marked paid. The
handler is idempotent, so a replayed notification changes nothing.

Going live with cards needs the on-ramp enabled in the NOWPayments dashboard (a
KYB step), after which no code change is required. A direct card processor (Stripe
and the like) is avoided on purpose: their terms forbid the "unauthorised sale of
branded goods" and the "resale of a service without added value", which this would
fall under, and they tend to freeze such accounts.

## Back-office

Operators sign in with Google. Account creation is gated in Better Auth's
`databaseHooks.user.create.before`: an email absent from `ADMIN_EMAILS` is
refused, so no one else can get in even with a valid Google account. Everything
under `/api/admin` then sits behind the session.

- **Orders** — the queue, with `needs_action`, `failed` and `underpaid` floated to
  the top, filterable by status.
- **An order** — its fields, the event history, and the actions that its current
  status allows: relaunch a failed order, confirm an underpaid one, or mark it
  refunded (behind a confirmation that names the consequence).
- **Keys** — stock per plan, and a paste-one-per-line import that hashes, seals and
  de-duplicates the keys.

## Testing

Four Vitest projects, chosen by filename: `client` (happy-dom), `server` (node),
`db` (`*.db.test.ts`, against a real Postgres in a database suffixed `_test`), and
`fuzz` (`*.fuzz.test.ts`, fast-check). `npm test` runs the first three and holds
coverage at **100%** on statements, branches, functions and lines — that is what
makes the suite worth trusting when it stays green. The db project creates and
migrates its own database, so development data is never touched.

`npm run e2e` builds the app, serves it on port 3101 against a `_e2e` database it
creates and empties, starts the fake upstream beside it, signs one admin account
in, then drives Chromium through the journeys: a full purchase to Premium-active
with the email landing at the fake Resend, a rejected key replaced from the
tracking page, a lookup by number and email, a key import, and an
[axe](https://github.com/dequelabs/axe-core) pass over every page. The sign-in
uses an email/password flow open only when `E2E_AUTH=true`, which the API refuses
to start with in production. `FUZZ_UI=true npm run e2e` additionally throws
hostile text at the forms.

`npm run fuzz` feeds generated junk — hostile strings, prototype-pollution keys,
oversized and malformed bodies, forged webhook signatures — at every public and
admin route and asserts none ever answers with a 500 or an unverified payment.

## CI

The workflows are centralised in `sv1nho/ci` as reusable workflows pinned to a
moving `@v1` tag; `.github/workflows/ci.yml` and `maintenance.yml` are thin
callers. On every push and pull request to `main`: quality (lint, types, knip),
build plus a first-load budget and a production-install boot that calls
`/api/health`, the test suites behind a schema-drift check (`db:check`), the
browser journeys, a CodeQL scan, and a dependency and secret scan. Nightly
maintenance runs the form and API fuzzing and opens a single advisories pull
request through a GitHub App. Third-party actions are pinned by commit SHA inside
the central repo.

## Errors and languages

Every refusal comes back in one shape, and `Accept-Language: fr` returns the
messages in French:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [{ "path": "email", "message": "…" }] } }
```

`details` names the field at fault, so a form can put each message beside it. The
repository is English: every UI string is wrapped in `t('…')`, and French lives in
catalogues keyed by the English phrase (`client/i18n/fr.ts`, `server/i18n/fr.ts`);
a missing entry falls back to readable English. In development the API prints each
refused request with its route, code and field; tests and production keep that
quiet.

## Authentication setup

Sign-in is Google only, for operators. Without a Google client the site still
runs — only the back-office sign-in is unavailable.

### 1. Session secret

```sh
openssl rand -base64 32
```

Put the result in `BETTER_AUTH_SECRET`. Without it sessions do not work and the
OAuth callback fails with a CSRF error.

### 2. Google client

1. Open <https://console.cloud.google.com/>, create a project.
2. **APIs & Services → OAuth consent screen**: user type **External**, fill in the
   app name and emails, leave it in **Testing**, and add the operator accounts
   under **Test users**. The default scopes (`email`, `profile`, `openid`) are
   enough.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**,
   application type **Web application**:
   - **Authorised JavaScript origins**: `http://localhost:5174`
   - **Authorised redirect URIs**: `http://localhost:5174/api/auth/callback/google`
4. Copy the client ID and secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

The redirect URI points at the **frontend** port, not the API: the browser only
talks to `localhost:5174`, and the Vite proxy forwards `/api`. A single character
of difference between it and `BETTER_AUTH_URL` breaks the flow. In production,
register the production URLs the same way and update `BETTER_AUTH_URL` and
`WEB_ORIGIN`.

### 3. Who may sign in

`ADMIN_EMAILS` is a comma-separated allow-list. Only those emails can create an
account; any other Google sign-in is refused before a user row is written.

## License

ISC, see [LICENSE](LICENSE). You may use, change and redistribute this, with or
without charge, as long as the copyright notice travels with it.
