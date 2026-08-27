# Cloud Arena

Cloud Arena is a greenfield-first, multi-cloud architecture decision engine. A user describes the system they want to build, and Cloud Arena returns functionally comparable AWS, Microsoft Azure, and Google Cloud architectures with estimated public list-price costs, constraints, a deterministic ranking, explanations, assumptions, and confidence.

The MVP proves one complete vertical slice for a Web API/SaaS using PostgreSQL, object storage, HTTP traffic, and a single primary region. It starts with a VM plus managed PostgreSQL baseline so pricing normalization can be validated before more complex architecture patterns are introduced.

## First demo

- Web API / SaaS
- 100,000 monthly active users
- Users primarily in Europe
- Medium traffic
- Production availability
- Balanced priority

The result must contain one AWS, Azure, and GCP candidate; selected regions and services; monthly cost breakdowns; scores; a recommendation and trade-offs; assumptions; confidence; missing information; constraint status; and the pricing timestamp.

## Principles

- Model provider-neutral capabilities; isolate provider behavior behind adapters.
- Keep the recommendation engine deterministic and free of LLM dependencies.
- Expose assumptions, provenance, uncertainty, exclusions, and heuristic judgments.
- Treat hard constraints separately from ranking preferences.
- Return alternatives and reasons instead of a hidden winner.
- Never fabricate pricing or claim functional equivalents are identical services.
- Make structured API results authoritative for the web UI and future consumers.

## Foundation stack

- Node.js 24 LTS, pnpm, Turborepo, and strict TypeScript
- Next.js and React
- Fastify
- PostgreSQL and Drizzle ORM
- Docker Compose, Vitest, Playwright, and GitHub Actions

Zod, OpenAPI, Pino, Tailwind CSS, and the component system are introduced by the milestones that need them rather than by the foundation scaffold.

## Documentation

- [Product vision](docs/product/vision.md)
- [MVP definition](docs/product/mvp.md)
- [Architecture overview](docs/architecture/overview.md)
- [Domain model](docs/architecture/domain-model.md)
- [Cost engine](docs/architecture/cost-engine.md)
- [API contract](docs/architecture/api.md)
- [Assumptions and confidence](docs/assumptions.md)
- [Scoring](docs/scoring.md)
- [Competitor context](docs/research/competitors.md)
- [Pricing sources and spikes](docs/research/pricing-sources.md)
- [Architecture decision records](docs/adr/README.md)
- [Implementation plan](docs/implementation-plan.md)
- [Detailed TODO](TODO.md)
- [Implementation status](docs/implementation-status.md)
- [Developer setup](docs/development.md)
- [Foundational implementation brief](docs/reference/original-implementation-brief.md)

## Repository shape

```text
apps/                 web and API applications
packages/             domain, contracts, engines, providers, and database
data/                 versioned assumptions, scoring, catalog, regions, and patterns
docs/                 product, architecture, research, ADRs, and delivery status
scripts/              operational and validation tooling
```

## Development workflow

Follow the [developer setup](docs/development.md) for exact installation, database, development, test, and build commands. Implementation proceeds in small milestones described in the [implementation plan](docs/implementation-plan.md). Each milestone must leave formatting, linting, type checking, tests, and builds passing. Provider parser tests use frozen fixtures; normal tests must not require live cloud APIs. Update [implementation status](docs/implementation-status.md) as work progresses.

## Current status

Documentation, the non-GCP technical spikes, and Milestones 0–2 and 4–6 are complete. The API and responsive web workflow now provide canonical workload validation, deterministic comparison/ranking, provider and architecture details, traceable costs, structured explanations, constraints, assumptions, confidence, and pricing status. Milestone 3 has atomic pricing snapshot persistence plus tested AWS and Azure adapters and a sync CLI. Authenticated GCP pricing evidence and selectors remain intentionally deferred under `SPIKE-A1-GCP`, so live GCP estimates remain explicitly unavailable rather than using fabricated prices.
