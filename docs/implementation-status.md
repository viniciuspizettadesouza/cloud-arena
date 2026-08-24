# Implementation Status

Last updated: 2026-08-25

## Completed

- Preserved the foundational implementation brief.
- Created product, MVP, architecture, domain, API, assumptions, scoring, research, and ADR documentation.
- Created the ordered implementation plan and detailed checkbox backlog.
- SPIKE-A1: captured representative AWS/Azure public pricing records and the GCP credential failure with complete request provenance.
- SPIKE-A2: documented provider field mappings, source-price identity, tier handling, unit rules, and explicit GCP fixture-dependent gaps.
- SPIKE-A3: froze atomic sync, retry/failure behavior, and 24/48/72-hour freshness states.
- SPIKE-B1/B2: selected the three launch-region trios, baseline services/SKUs, availability rules, Layer 7 load balancers, and no-CDN baseline.
- SPIKE-C1: froze public-egress formulas, provider units, launch-geography tiers, free allowances, and boundary fixtures.
- SPIKE-D1: documented conservative caching, retention, redistribution, and attribution controls plus public-launch blocker `LEGAL-PRICING-001`.
- SPIKE-E1/E2: froze three calculator architectures and approved the initial 2% deviation policy with absolute floors and exception rules.
- M0-001: initialized the pnpm/Turborepo workspace with Node 24 LTS metadata, a strict shared TypeScript 6 configuration, root task scripts, and a frozen lockfile.
- M0-002: added a Fastify API health route and Next.js web shell, both served by the root development command.
- M0-003: established contracts, domain, catalog, assumptions, pricing, scoring, recommendation, provider, and database packages with automated dependency-boundary validation.
- M0-004: added PostgreSQL 18 development Compose configuration, Drizzle schema and migration tooling, a committed initial migration, and a verified connectivity check.
- M0-005: configured Prettier, ESLint, TypeScript, Vitest, Playwright, Turborepo tasks, and root quality scripts.
- M0-006: added an unsuppressed GitHub Actions pipeline covering frozen installation, database migration, all quality gates, build, and browser testing.
- M0-007: documented clean-checkout installation, environment, database, development, test, and build commands.

## Deferred

- SPIKE-A1-GCP authenticated Catalog record capture remains deferred until a GCP API key or accepted caller identity is intentionally configured.
- `LEGAL-PRICING-001` must be cleared during M7-004 before any public launch; it does not block private development or M0–M6.

## Next

1. Implement canonical workload schemas and tests under M1-001.
2. Add validated, versioned workload assumptions under M1-002.
3. Keep GCP credential-dependent pricing evidence deferred under SPIKE-A1-GCP; M3-004 and downstream all-provider pricing coverage remain blocked by it.

## Known limitations

- The API and web application are foundation shells only; comparison, catalog, pricing, scoring, recommendation, and user workflow behavior are not implemented yet.
- The initial database schema contains only foundation metadata; pricing persistence begins in Milestone 3.
- Initial workload heuristic values and confidence weights/thresholds remain to be frozen in Milestone 1.
- GCP exact Catalog service/SKU selectors and source pricing expressions remain unresolved until SPIKE-A1-GCP.
- Calculator totals have not yet been captured; E1 freezes the inputs and M7-002 performs the nine official comparisons.
- Public derived-price presentation remains subject to `LEGAL-PRICING-001` and M7-004.
- Competitor notes are directional and require revalidation before public use.

## Technical decisions

- Provider-neutral domain and adapter boundaries.
- API-first structured results.
- Deterministic engine with versioned inputs and no MVP LLM dependency.
- Locally synchronized pricing snapshots.
- Version-controlled YAML semantic knowledge.
- USD public on-demand/list pricing only for MVP.
- Node 24 LTS, pnpm 11, Turborepo 2, and strict TypeScript 6 as the initial workspace toolchain.

See the [ADR index](adr/README.md) for rationale and consequences.
