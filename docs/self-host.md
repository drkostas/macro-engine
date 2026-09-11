# Self-Hosting Guide

Detailed troubleshooting, backup/restore, and upgrade instructions for
MacroEngine. For initial setup, see the [README](../README.md).

---

## Troubleshooting

### Port 3457 already in use

Another process is using port 3457. Either stop it, or change the port:

```bash
# Option 1: use a different port via environment variable
PORT=3458 docker compose up
```

Or edit `docker-compose.yml` and change the ports mapping:

```yaml
ports:
  - "127.0.0.1:3458:3457"
```

This maps host port 3458 to the container's 3457. Open
`http://localhost:3458` instead.

### Database connection refused

If the web container fails to connect to Postgres:

```bash
docker compose logs postgres
```

Common causes:

- Postgres is still starting. The web service waits for a healthcheck, but on
  slow machines the first boot can take 30+ seconds while it initializes the
  data directory.
- The `macroengine_db` volume has corrupted data. If you don't care about
  existing data: `docker compose down -v && docker compose up`.
- You changed `POSTGRES_PASSWORD` in `docker-compose.yml` after the volume was
  already created. Postgres only reads these variables on first initialization.
  Either drop the volume (`docker compose down -v`) or connect manually and
  `ALTER USER`.

### Garmin SSO failed

Garmin blocks OAuth token exchange from most cloud provider IPs. If you are
running MacroEngine on AWS, GCP, Azure, or similar, the default Cloudflare
Worker proxy should handle this. If SSO still fails:

1. Check that `GARMIN_AUTH_PROXY_URL` is set in your `.env`.
2. Try the default value: `https://garmin-auth.kostasgeorgiou.workers.dev`.
3. If the default proxy is down, deploy your own -- see
   [garmin-auth's worker README](https://github.com/drkostas/garmin-auth/tree/main/worker). It takes 5 minutes.
4. Check `docker compose logs web` for the actual error message.

If you are running locally (not on a cloud VM), Garmin SSO should work without
a proxy. You can try removing `GARMIN_AUTH_PROXY_URL` from `.env` entirely.

### "MACROENGINE_SECRET is required" error on startup

In production mode (Docker), both `MACROENGINE_PASSWORD` and
`MACROENGINE_SECRET` must be set. Generate a secret:

```bash
openssl rand -base64 32
```

Paste the output into your `.env` as the `MACROENGINE_SECRET` value.

### Login page appears but password is rejected

Double-check that the value in `.env` for `MACROENGINE_PASSWORD` matches what
you are typing. Watch for trailing whitespace or quotes in the `.env` file.
The password is compared byte-for-byte.

---

## Backup and restore

### Backup

Dump the database to a SQL file:

```bash
docker exec macro-engine-postgres-1 pg_dump -U macroengine macroengine > backup.sql
```

If your container has a different name, check with `docker ps`.

Store `backup.sql` somewhere safe. It contains all your meals, weight logs,
ingredients, and profile data.

### Restore

To restore into a fresh instance:

```bash
# Start only Postgres
docker compose up -d postgres

# Wait for it to be ready
docker compose exec postgres pg_isready -U macroengine

# Restore the backup (this replaces all data)
docker compose exec -T postgres psql -U macroengine macroengine < backup.sql

# Start the web app
docker compose up -d web
```

To restore into a native (non-Docker) Postgres:

```bash
psql macroengine < backup.sql
```

---

## Upgrading

### Standard upgrade

```bash
docker compose down
git pull
docker compose up --build -d
```

This rebuilds the web image with the latest code and restarts everything.
Your data is preserved in the `macroengine_db` volume.

### Schema migrations

MacroEngine does not use an automated migration tool. Schema changes are
documented in release notes with the exact SQL to run.

After pulling a new version, check the release notes. If a migration is
needed, it will look something like:

```bash
# Example -- check the actual release notes for the real SQL
docker compose exec postgres psql -U macroengine macroengine -c "ALTER TABLE ..."
```

Always back up before running migrations.

### Full reset

If you want to start completely fresh:

```bash
docker compose down -v
docker compose up --build -d
```

The `-v` flag deletes the Postgres volume. All data is gone. The database
will be re-initialized from `schema.sql` and `seed.sql` on next boot.

---

## Docker Compose reference

The default `docker-compose.yml` runs two services:

- **postgres** -- PostgreSQL 17 Alpine. Data stored in a named volume
  (`macroengine_db`). Schema and seed SQL are mounted into
  `/docker-entrypoint-initdb.d/` and run only on first boot (empty volume).
- **web** -- Next.js app built from `web/Dockerfile`. Depends on Postgres
  being healthy. Reads environment from `.env`. Listens on `127.0.0.1:3457`.

The port binding `127.0.0.1:3457:3457` means the app is only accessible from
localhost. To expose it to the network, change to `0.0.0.0:3457:3457` -- but
read the "Deploying beyond localhost" section in the README first.
