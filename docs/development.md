# Developer setup

## Prerequisites

- Node.js 24 LTS, matching `.nvmrc` or `.node-version`
- Corepack with pnpm 11.23.0
- Docker with either the `docker compose` plugin or standalone `docker-compose`

## Clean checkout

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm exec playwright install chromium
```

The example environment contains development-only credentials. Do not put production credentials in
`.env`; the file is ignored by Git. If port 5432 is already occupied, change both `POSTGRES_PORT` and
the port in `DATABASE_URL` to the same unused port, such as 55432.

## Database

Start PostgreSQL, apply all committed Drizzle migrations, and verify connectivity:

```sh
pnpm db:up
pnpm db:migrate
pnpm db:check
```

Generate a migration after changing `packages/database/src/schema.ts`:

```sh
pnpm db:generate
```

Stop the development database without deleting its named volume:

```sh
pnpm db:down
```

## Development servers

Start the Fastify API and Next.js application together:

```sh
pnpm dev
```

- Web: <http://localhost:3000>
- API health: <http://localhost:3001/health>

The ports can be overridden with `WEB_PORT` and `API_PORT` in `.env`.

## Quality gates

Run the non-browser Milestone 0 gates together:

```sh
pnpm check
```

Or run each gate independently:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Use `pnpm format` to apply formatting. Normal unit tests use local fixtures and do not call live cloud
pricing APIs.

## Pricing synchronization

Apply database migrations, then synchronize every provider or one provider:

```sh
pnpm pricing:sync
pnpm pricing:sync --provider aws
pnpm pricing:sync --provider azure
pnpm pricing:sync --provider gcp
```

AWS and Azure use their public pricing endpoints with bounded retries. GCP exits with an actionable
configuration error until `SPIKE-A1-GCP` supplies authenticated fixtures and reviewed SKU selectors;
an all-provider run therefore reports the AWS/Azure outcomes and exits nonzero for the explicit GCP
gap. A provider snapshot activates only after every requested launch region and baseline category is
present and validated. Failed or partial snapshots never replace the previous active snapshot.

Run the retention job on an operator-controlled schedule after migrations:

```sh
pnpm pricing:prune
```

It deletes raw provider payloads older than 90 days and inactive normalized snapshots older than
13 months. Pricing records retain source identity after their raw payload expires. Active snapshots
are never deleted by this job. These are the current engineering defaults; public deployment still
requires the provider-specific clearance recorded under `LEGAL-PRICING-001`.
