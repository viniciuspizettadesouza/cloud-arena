# Implementation Plan

## Delivery strategy

Deliver one trustworthy vertical slice before expanding scope. Work is ordered by dependency and risk; each milestone ends with a demonstrable artifact and passing repository quality gates. The detailed executable backlog is in [TODO.md](../TODO.md).

## Stage 1 — Technical spikes

Validate the difficult external facts first: representative pricing API records, exact SKU/service availability, network-egress formulas, pricing-data usage terms, and official-calculator comparisons. Produce short decision records, sanitized fixtures, known gaps, and an agreed cost-deviation threshold.

Research can begin before the monorepo exists. Fixture/parser code lands after Milestone 0 establishes packages and test tooling. Findings override assumptions in the foundational brief when official sources disagree.

## Stage 2 — Milestone 0: foundation

Create the pnpm/Turborepo TypeScript workspace, Next.js web app, Fastify API, shared domain/contracts packages, PostgreSQL/Drizzle package, Docker Compose, Vitest/Playwright setup, formatting/lint/type checking, and GitHub Actions.

Acceptance: a clean checkout can install, run development services, format-check, lint, typecheck, test, and build using documented commands.

## Stage 3 — Milestone 1: domain engine

Implement Zod-backed workload input, versioned assumptions, normalization, provenance, confidence, missing-information ranking, and monthly-budget constraints without cloud APIs.

Use the reference workload (100,000 users, Europe, medium traffic, production availability, balanced priority) as the first stable normalization fixture.

Acceptance: Quick Mode input deterministically returns a normalized technical workload with assumptions, provenance, confidence, missing information, and constraint input.

## Stage 4 — Milestone 2: semantic catalog

Define validated YAML schemas and data for capabilities, launch regions, provider mappings, and the `vm-managed-postgres` pattern. Generate one AWS, Azure, and GCP architecture candidate from a normalized workload.

Acceptance: each candidate contains a validated region and functionally comparable compute, managed PostgreSQL, object storage, load-balancing, and applicable CDN components, without claiming identity.

## Stage 5 — Milestone 3: pricing adapters

Implement AWS, Azure, and GCP adapters from frozen fixtures, then enable live synchronization into PostgreSQL snapshots. Preserve normalized and raw traceability data and support all-provider/per-provider CLI runs.

Acceptance: local storage contains current normalized public prices for every modeled baseline component in supported launch regions, or an explicit documented gap.

## Stage 6 — Milestone 4: cost engine

Calculate compute, database compute/storage, object storage, internet egress, and load-balancing monthly line items from normalized workload and architecture components.

Acceptance: each candidate returns available/unavailable status, total, traceable breakdown, included/excluded items, timestamp, and confidence. Missing pricing never produces a fabricated total.

## Stage 7 — Milestone 5: recommendation engine and API

Implement constraint evaluation, versioned scoring profiles, ranking, structured reasons, caveats, trade-offs, and the initial API surface/OpenAPI.

Acceptance: `POST /v1/compare` produces a complete deterministic comparison for all providers and identifies versions of all determining datasets.

## Stage 8 — Milestone 6: frontend

Build Quick Mode, Advanced overrides, provider cards, comparison table, read-only architecture view, cost breakdowns, recommendation explanation, assumptions, confidence, missing information, and constraint states.

Acceptance: a user unfamiliar with cloud SKUs completes the reference scenario and understands the result.

## Stage 9 — Milestone 7: validation and MVP completion

Freeze golden workloads/pricing snapshots, compare three reference architectures with official calculators, investigate material discrepancies, test the complete browser/API flow, document limitations, and perform the MVP definition-of-done review.

Acceptance: modeled components meet the spike-defined deviation threshold or have explained exceptions; all quality gates pass; all fifteen MVP outcomes in [mvp.md](product/mvp.md) are demonstrated.

## Test strategy

- Unit: normalization, assumptions, provenance, confidence, constraints, scoring, cost formulas, and region selection.
- Provider parser: frozen sanitized API fixtures; no live API dependency in normal tests.
- Golden: fixed workloads plus frozen pricing/configuration versions; never assume a permanent provider winner.
- API integration: validation, metadata, unavailable pricing, constraints, and `/v1/compare`.
- E2E: submit Quick Mode, receive three candidates, inspect costs, assumptions, confidence, and recommendation.

## Quality and change control

Every implementation milestone must pass format check, lint, TypeScript typecheck, unit/integration tests, and build. Relevant UI milestones also pass Playwright. Do not suppress errors to make CI green.

Update [implementation-status.md](implementation-status.md) after each milestone. Record material architectural changes as ADRs and provider-source discrepancies in research documentation. Do not add post-MVP features merely because they are convenient.

