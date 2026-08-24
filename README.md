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

## Planned stack

- pnpm, Turborepo, and TypeScript
- Next.js, React, Tailwind CSS, and shadcn/ui
- Fastify, Zod, OpenAPI, and Pino
- PostgreSQL and Drizzle ORM
- Docker Compose, Vitest, Playwright, and GitHub Actions

No application code is present yet. Package versions will be selected from current stable releases during Milestone 0.

## Documentation

- [Product vision](docs/product/vision.md)
- [MVP definition](docs/product/mvp.md)
- [Architecture overview](docs/architecture/overview.md)
- [Domain model](docs/architecture/domain-model.md)
- [API contract](docs/architecture/api.md)
- [Assumptions and confidence](docs/assumptions.md)
- [Scoring](docs/scoring.md)
- [Competitor context](docs/research/competitors.md)
- [Pricing sources and spikes](docs/research/pricing-sources.md)
- [Architecture decision records](docs/adr/README.md)
- [Implementation plan](docs/implementation-plan.md)
- [Detailed TODO](TODO.md)
- [Implementation status](docs/implementation-status.md)
- [Foundational implementation brief](docs/reference/original-implementation-brief.md)

## Planned repository shape

```text
apps/                 web and API applications
packages/             domain, contracts, engines, providers, and database
data/                 versioned assumptions, scoring, catalog, regions, and patterns
docs/                 product, architecture, research, ADRs, and delivery status
scripts/              operational and validation tooling
```

## Development workflow

Implementation proceeds in small milestones described in the [implementation plan](docs/implementation-plan.md). Each milestone must leave formatting, linting, type checking, tests, and builds passing. Provider parser tests use frozen fixtures; normal tests must not require live cloud APIs. Update [implementation status](docs/implementation-status.md) as work progresses.

## Current status

Documentation bootstrap is complete. Technical spikes and all product implementation remain pending.
