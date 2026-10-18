# boost-my-spot

Upgrades an existing Spotify account to Premium on a customer's behalf, and lets
them follow that upgrade to completion. Guest checkout, no customer account.

> Not affiliated with, or endorsed by, Spotify AB. "Spotify" is a trademark of
> its owner.

## What it does

A visitor picks a plan and a country, pastes their Spotify session key (we never
ask for a password), pays, and gets an order reference. A background worker runs
the upgrade through the reseller API and moves the order through
`awaiting payment → paid → upgrading → active`. The visitor follows it on a
tracking page that refreshes itself, and gets the same by email. If the upgrade
needs a fresh session key, or Premium later stops, they fix it themselves from
the tracking page.

## Repository layout

| Path | What lives there |
|---|---|
| `client/` | React app: pages, routing, i18n, the single stylesheet |
| `server/` | Express API: app factory, middleware, auth, services, worker |
| `shared/` | Types and pure logic used by both sides |
| `prisma/` | Schema, migrations, seed |
| `e2e/` | Playwright journeys and their database setup |
| `scripts/` | Bundle budget, advisories, backups |

## Local setup

```sh
cp .env.example .env            # then fill POSTGRES_PASSWORD and BETTER_AUTH_SECRET
npm install
npm run db:up                   # Postgres in Docker, host port 5434
npm run db:deploy               # apply migrations
npm run dev                     # client on 5174, api on 3001
```

The client talks to the API through the Vite proxy, so both are same-origin in
development. Ports are shifted from ShipBox (Postgres 5434, API 3001, web 5174)
so the two projects can run side by side.

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | client and api together, watched |
| `npm run build` | `dist/web` (served) and `dist/api` (compiled server) |
| `npm start` | run the compiled server, no transpiler |
| `npm test` | client + server + db suites, 100% coverage thresholds |
| `npm run fuzz` | property and API fuzzing |
| `npm run e2e` | Playwright journeys |
| `npm run lint` / `typecheck` / `knip` | quality gates |
| `npm run size` | first-load gzip budget |
| `npm run db:*` | up, down, migrate, deploy, check, studio, seed, backup, restore |
| `npm run advisories` | smallest dependency bump that closes npm advisories |

Production installs with `npm ci --omit=dev --omit=optional --ignore-scripts`:
the browser libraries live in `devDependencies` because Vite bundles them into
`dist/web`, and the Node process never imports them. `dist/web` is the only
directory served; `dist/api` sits outside `express.static`.

### Container

`Dockerfile` is a two-stage build pinned by digest, running as `USER node`.
Migrations are **not** in the image: `prisma migrate deploy` is a release step.

## Testing

Four Vitest projects: `client` (happy-dom), `server` (node), `db` (a real
Postgres, database name suffixed `_test`), and `fuzz` (fast-check). Coverage is
held at 100% on statements, branches, functions and lines. The browser journeys
run against a `_e2e` database and sign in through an email/password flow that is
open only when `E2E_AUTH=true`, which the API refuses in production.

## CI

`pipeline.yml` runs on every push and pull request to `main`: quality (lint,
types, knip), build plus a first-load budget and a production-install boot that
calls `/api/health`, the test suites behind a schema-drift check, the browser
journeys, a CodeQL scan, and a dependency and secret scan. `maintenance.yml`
runs nightly: form and API fuzzing, and an advisories pass that opens a single
pull request. Every action is pinned by commit SHA.

## The upgrade API and payments

The upgrade runs through a reseller API, authenticated per request with a
Spotify `sp_dc` session cookie (password login is not supported upstream). The
cookie is sealed at rest, never logged, and deleted once it is no longer needed.
Payments go through a crypto provider in v1, behind a `PaymentProvider` seam so
a card provider can be added later.

## Languages

The repository is English. The UI ships English and French from catalogues keyed
by the English phrase (`client/i18n/fr.ts`, `server/i18n/fr.ts`); a missing entry
falls back to readable English.

## Authentication setup

The back-office signs in with Better Auth through Google. Set a session
secret (`openssl rand -base64 32`) and the Google OAuth pair in `.env`; only
emails listed in `ADMIN_EMAILS` can create an account.

## License

ISC, see [LICENSE](LICENSE).
