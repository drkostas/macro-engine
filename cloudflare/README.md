# Garmin SSO Proxy (Cloudflare Worker)

Garmin blocks OAuth token exchange from cloud provider IPs (AWS, Azure, GCP).
This Cloudflare Worker runs on Cloudflare's edge network, which uses
residential-class IPs that Garmin does not block.

MacroEngine uses this proxy during Garmin account linking in the `/setup` page.

---

> **PRIVACY WARNING**
>
> The default `GARMIN_AUTH_PROXY_URL` in `.env.example` points to kostas's
> shared Cloudflare Worker. **It sees your Garmin credentials during SSO
> login.** For any real use, deploy your own worker. It takes 5 minutes
> and is completely free (Cloudflare Workers free tier: 100k requests/day).

---

## Deploy your own (5 minutes)

### 1. Create a free Cloudflare account

Sign up at https://dash.cloudflare.com/sign-up. No credit card required.

### 2. Install Wrangler and log in

```bash
npm install -g wrangler
wrangler login
```

This opens a browser window to authorize the CLI with your Cloudflare account.

### 3. Install dependencies and deploy

```bash
cd cloudflare
npm install
npm run deploy
```

Wrangler prints the deployed URL, something like:

```
https://macro-engine-garmin-auth.<your-subdomain>.workers.dev
```

### 4. Update your `.env`

Set the `GARMIN_AUTH_PROXY_URL` environment variable to your new worker URL:

```
GARMIN_AUTH_PROXY_URL=https://macro-engine-garmin-auth.<your-subdomain>.workers.dev
```

### 5. Restart the app

```bash
docker compose down && docker compose up -d
```

The `/setup` page will now route Garmin SSO through your own proxy.

## Optional: Enable direct credential login (MFA support)

The default ticket-based flow (`/exchange`) works without any extra setup.
If you want the direct email/password login flow with MFA support, create a
KV namespace for MFA session storage:

```bash
wrangler kv namespace create MFA_SESSIONS
```

Paste the returned namespace ID into `wrangler.toml` (uncomment the
`[[kv_namespaces]]` block and fill in the id), then redeploy:

```bash
npm run deploy
```

## API endpoints

| Endpoint | Body | Description |
|---|---|---|
| `POST /exchange` | `{ ticket }` | Exchange a Garmin CAS service ticket (ST-...) for DI OAuth tokens |
| `POST /login` | `{ email, password }` | Direct credential login (requires KV for MFA) |
| `POST /login-mfa` | `{ session_id, mfa_code }` | Complete MFA verification (requires KV) |

## Local development

```bash
cd cloudflare
npm install
npm run dev
```

This starts a local dev server (default port 8787) that you can point
`GARMIN_AUTH_PROXY_URL` at for testing.
