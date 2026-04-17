# MacroEngine

MacroEngine is a self-hosted nutrition tracker for people who take their macros
seriously. Log meals, track weight, set deficit targets, compose meal variations.
Single-user by design -- one instance per person.

Extracted from the [soma training stack](https://github.com/drkostas/soma).

> Screenshot coming soon.

---

## Quick start (Docker)

You need [Docker](https://docs.docker.com/get-docker/) installed. Nothing else.

```bash
git clone https://github.com/drkostas/macro-engine.git
cd macro-engine
cp .env.example .env
```

Open `.env` and change two values:

- `MACROENGINE_PASSWORD` -- pick a login password (min 12 characters).
- `MACROENGINE_SECRET` -- generate one: `openssl rand -base64 32`.

Then start the stack:

```bash
docker compose up
```

Open [http://localhost:3457](http://localhost:3457), log in with your password,
and complete the onboarding wizard (weight, height, age, goals). You are done.

To run in the background: `docker compose up -d`.
To stop: `docker compose down`. Your data is preserved in a Docker volume.
To destroy everything including data: `docker compose down -v`.

---

## Dev setup (native)

For contributing or running without Docker.

### Prerequisites

- Node.js 20+
- PostgreSQL 17

### Steps

```bash
createdb macroengine
psql macroengine -f web/db/schema.sql
psql macroengine -f web/db/seed.sql
cd web
cp ../.env.example .env.local
```

Edit `web/.env.local`:

- Set `DATABASE_URL` to your local Postgres connection string, e.g.
  `postgresql://localhost:5432/macroengine`.
- Set `MACROENGINE_PASSWORD` and `MACROENGINE_SECRET`, or leave them unset to
  skip auth in dev mode.

```bash
npm ci
npm run dev
```

The dev server starts at [http://localhost:3457](http://localhost:3457).

Run tests:

```bash
npm test -- --run
```

---

## Configuration

All configuration lives in environment variables. Copy `.env.example` to `.env`
(Docker) or `.env.local` (native dev) and edit as needed.

### Required

| Variable | Purpose | Default in Compose |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | `postgresql://macroengine:macroengine@postgres:5432/macroengine` |
| `MACROENGINE_PASSWORD` | Shared login password (min 12 chars) | `please-change-me` |
| `MACROENGINE_SECRET` | HMAC key for session cookies | `please-change-me-with-openssl-rand` |

### Optional

| Variable | Purpose | When missing |
|---|---|---|
| `GARMIN_AUTH_PROXY_URL` | Garmin SSO proxy for step/calorie sync | Setup page shows "Garmin disabled" |
| `AI_GATEWAY_API_KEY` | Natural-language meal parsing | Input shows "AI parsing disabled" |
| `CRON_SECRET` | Auth token for `/api/cron/*` endpoints | Cron endpoints are unprotected |

The app works without any optional variables. Features degrade gracefully with
a clear message explaining what to set.

### Garmin integration

The default `GARMIN_AUTH_PROXY_URL` in `.env.example` points to a shared
Cloudflare Worker. It works out of the box but routes your Garmin credentials
through a third party during SSO.

For real use, deploy your own worker. It takes 5 minutes and is free. See
[cloudflare/README.md](cloudflare/README.md) for instructions.

To disable Garmin entirely, leave `GARMIN_AUTH_PROXY_URL` blank.

### AI meal parsing

Set `AI_GATEWAY_API_KEY` to a Vercel AI Gateway key. When set, the meal
logging page shows a "Describe a meal" input that parses natural-language
descriptions into structured ingredients.

Get a key at [vercel.com/ai-gateway](https://vercel.com/ai-gateway).

---

## Deploying beyond localhost

MacroEngine binds to `127.0.0.1:3457` by default. To access it from other
devices, you need to expose that port.

**Before exposing the app: change `MACROENGINE_PASSWORD` to something strong.**
The default `please-change-me` is not a real password.

### Tailscale (easiest)

Install [Tailscale](https://tailscale.com/download) on the host machine and
on any device you want to access MacroEngine from. Then:

```bash
tailscale serve 3457
```

Access MacroEngine from any device on your tailnet at
`https://<hostname>.<tailnet>.ts.net`.

### Cloudflare Tunnel

Install [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
and create a tunnel:

```bash
cloudflared tunnel --url localhost:3457
```

This gives you a public `*.trycloudflare.com` URL. For a permanent setup with
a custom domain, see the
[Cloudflare Tunnel docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/).

---

## Troubleshooting

See [docs/self-host.md](docs/self-host.md) for detailed troubleshooting,
backup/restore procedures, and upgrade instructions.

---

## License

MIT
