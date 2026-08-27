# Implementation Status

Last updated: 2026-08-27

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
- M1-001: implemented strict Zod contracts and inferred types for the canonical Quick and Advanced workload input, normalized workload, provenance, assumptions, confidence, missing information, and budget constraints.
- M1-002: added validated `workload-v1` YAML heuristics for traffic, storage, availability, geography, and confidence; malformed, incomplete, and internally inconsistent configurations fail fast.
- M1-003: implemented deterministic request-rate, peak, egress, storage, availability-target, and region-preference normalization with visible assumptions and field-level provenance; explicit overrides take precedence.
- M1-004: implemented weighted confidence scoring and labels plus deterministic impact-ranked missing information.
- M1-005: implemented absent, pending, satisfied, and violated monthly-budget constraint states with expected/actual violation details.
- M1-006: froze the 100,000-user Europe/medium/production/balanced normalization fixture and deterministic output tests.
- M1-007: passed Milestone 1 format, lint, boundary, type, unit-test, and build quality gates.
- M2-001: added strict schemas and a multi-document YAML loader for versioned capabilities, providers, regions, patterns, evidence, and cross-document references; duplicate and invalid references fail fast.
- M2-002/M2-003: curated five AWS/Azure/GCP capability mappings and nine evidenced launch regions with explicit product differences, availability caveats, deterministic geography defaults, and no latency claim.
- M2-004: defined the provider-neutral `vm-managed-postgres` component graph, CDN exclusion, and standard through mission-critical availability rules.
- M2-005: implemented deterministic generation of exactly one catalog-versioned AWS, Azure, and GCP candidate from a normalized workload, retaining service configurations, deployment options, graph relationships, exclusions, and caveats.
- M2-006: passed Milestone 2 format, lint, boundary, type, unit-test, and build quality gates.
- M3-001: added immutable provider pricing snapshots, raw payloads/checksums, normalized tier records, provider-scoped sync locks, failure evidence, and transactionally guarded per-provider activation; failed staging syncs preserve the previous active snapshot.
- M3-002: implemented a bounded-retry, EOF-validated streaming AWS regional bulk CSV adapter with catalog-baseline selectors, resolved catalog-version traceability, canonical units, source price identities, and frozen representative fixture/parser tests.
- M3-003: implemented the paginated Azure Retail Prices adapter with trusted next-link validation, repeated-link detection, catalog-baseline selectors, tier derivation, canonical units, source identities, and frozen fixture/parser tests.
- Added the `pnpm pricing:sync` operational path for all-provider and `--provider aws|azure|gcp` runs. It reports snapshot record/gap counts and records explicit failures; M3-005 remains incomplete until the GCP dependency is resolved.
- M4-001: added strict available/unavailable estimate, line-item, pricing-trace, inclusion/exclusion, formula, gap, timestamp, confidence, and calculation-version contracts; unavailable estimates cannot carry a fabricated total.
- M4-002: implemented exact monthly compute, deployment-aware managed PostgreSQL compute, and tiered database-storage formulas with 730-hour and explicit GB/GiB conventions.
- M4-003: implemented tiered object storage, public egress, and provider-specific load-balancing formulas, including AWS's allowance, Azure's frozen capacity rule, GCP unit conversion, and every accepted egress boundary case.
- M4-004: added deterministic one/all-candidate estimate assembly and an active-snapshot reader; complete estimates return totals while missing, ambiguous, incompatible, or discontinuous records return explicit unavailable gaps with successful partial lines retained.
- M4-005: passed repository-wide format, lint, dependency-boundary, typecheck, unit-test, and build gates with cost-contract and 13 cost-engine tests.

## Deferred

- SPIKE-A1-GCP authenticated Catalog record capture remains deferred until a GCP API key or accepted caller identity is intentionally configured.
- M3-004 remains blocked by SPIKE-A1-GCP. The GCP adapter now rejects missing credentials and the unresolved selector state with actionable errors, but it cannot normalize or activate unverified SKUs.
- `LEGAL-PRICING-001` must be cleared during M7-004 before any public launch; it does not block private development or M0–M6.

## Next

1. Supply an intentional GCP caller identity and complete SPIKE-A1-GCP with sanitized authenticated SKU fixtures.
2. Implement and verify the GCP parser/selectors under M3-004, enabling completion of the existing all-provider sync CLI.
3. Run live launch-region synchronization, capture the coverage report, and pass the remaining Milestone 3 database and quality gates.
4. Begin the unblocked Milestone 5 scoring configuration while the GCP credential-dependent path remains deferred.

## Known limitations

- The API and web application are foundation shells only; the implemented normalization, catalog candidate-generation, pricing-ingestion, and cost engines are not exposed through API routes yet, and scoring, recommendation, and user workflow behavior are not implemented.
- Pricing persistence and AWS/Azure adapters are implemented, but no committed snapshot is treated as current public pricing; operators must migrate the local database and run the live sync command.
- GCP exact Catalog service/SKU selectors and source pricing expressions remain unresolved until SPIKE-A1-GCP.
- GCP candidate estimates therefore remain explicitly unavailable with live data until the authenticated pricing gap is resolved; frozen tests verify the calculation behavior without treating those fixtures as current prices.
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
