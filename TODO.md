# Cloud Arena Implementation TODO

This is the execution backlog for the MVP. Stable IDs should be referenced in commits and pull requests. All implementation tasks are intentionally pending; checked items cover this documentation bootstrap only.

For each milestone, “quality gates” means format check, lint, typecheck, relevant tests, and build. Playwright is additionally required once the web flow exists.

## Documentation bootstrap

- [x] **DOC-001 — Preserve the foundational brief.** Depends on: none. Output: versioned source under `docs/reference`. Acceptance: original supplied content is retained with provenance.
- [x] **DOC-002 — Establish focused project documentation.** Depends on: DOC-001. Output: product, architecture, domain, API, assumptions, scoring, research, and ADR documents. Acceptance: README links to the maintained knowledge set.
- [x] **DOC-003 — Create delivery plan and backlog.** Depends on: DOC-002. Output: implementation plan, stable task IDs, dependencies, acceptance criteria, and status tracker. Acceptance: spikes and Milestones 0–7 are represented.

## Technical spikes

- [ ] **SPIKE-A1 — Capture representative provider price records.** Depends on: DOC-003. Output: redacted/sanitized AWS, Azure, and GCP response samples for every baseline cost category. Acceptance: source URL/API, request parameters, retrieval time, and required credentials are recorded.
- [ ] **SPIKE-A2 — Define pricing normalization mappings.** Depends on: SPIKE-A1. Output: field-by-field provider-to-`PricingRecord` mapping and unit conversion notes. Acceptance: compute, database compute/storage, object storage, load balancing, and egress are covered or explicitly marked unresolved.
- [ ] **SPIKE-A3 — Define sync failure and freshness requirements.** Depends on: SPIKE-A1. Output: documented pagination, retries, rate limits, partial-snapshot behavior, and proposed freshness rule. Acceptance: no failure path authorizes fabricated pricing.
- [ ] **SPIKE-B1 — Select candidate launch regions and exact services/SKUs.** Depends on: SPIKE-A1. Output: evidence table for Europe, North America, and South America across providers. Acceptance: each baseline component has a deployability source separate from its price.
- [ ] **SPIKE-B2 — Validate networking components.** Depends on: SPIKE-B1. Output: decision on the appropriate load balancer and when CDN is included per provider. Acceptance: comparable capability and material differences are documented.
- [ ] **SPIKE-C1 — Model required public internet egress tiers.** Depends on: SPIKE-A1, SPIKE-B1. Output: formulas, boundaries, free allowances, units, and source references for launch scenarios. Acceptance: fixtures exercise every implemented tier boundary.
- [ ] **SPIKE-D1 — Review pricing-data usage terms.** Depends on: SPIKE-A1. Output: documented caching, retention, redistribution, and attribution requirements for all providers. Acceptance: blockers and required notices are identified before any public launch.
- [ ] **SPIKE-E1 — Define calculator reference architectures.** Depends on: SPIKE-B2, SPIKE-C1. Output: three frozen workloads and matching provider-calculator component selections. Acceptance: inputs and exclusions are reproducible.
- [ ] **SPIKE-E2 — Set initial cost-deviation policy.** Depends on: SPIKE-E1. Output: component and total comparison method plus acceptable deviation threshold. Acceptance: threshold and exception-recording rules are approved before Milestone 7.

## Milestone 0 — Foundation

- [ ] **M0-001 — Initialize the workspace.** Depends on: SPIKE-A2. Output: pnpm workspace, Turborepo, shared TypeScript config, package scripts, lockfile, and supported runtime metadata. Acceptance: clean install succeeds with current stable dependencies.
- [ ] **M0-002 — Scaffold API and web applications.** Depends on: M0-001. Output: Fastify API with health route and Next.js web shell. Acceptance: both run through the documented development command.
- [ ] **M0-003 — Scaffold domain and infrastructure packages.** Depends on: M0-001. Output: contracts, domain, catalog, assumptions, pricing, scoring, recommendation, provider, and database package boundaries. Acceptance: dependency direction is enforced and the domain imports no framework/provider SDK.
- [ ] **M0-004 — Add PostgreSQL development environment.** Depends on: M0-003. Output: Docker Compose service, Drizzle setup, migration workflow, and example environment documentation. Acceptance: database starts and a connectivity check passes without committed secrets.
- [ ] **M0-005 — Configure quality tooling.** Depends on: M0-001. Output: formatter, linter, typecheck, Vitest, Playwright foundation, and root scripts. Acceptance: tools run consistently across workspaces without rewriting during check mode.
- [ ] **M0-006 — Add continuous integration.** Depends on: M0-002, M0-004, M0-005. Output: GitHub Actions workflow for install, format check, lint, typecheck, tests, and build. Acceptance: a clean CI run passes and failures are not suppressed.
- [ ] **M0-007 — Document developer setup.** Depends on: M0-002, M0-004, M0-005. Output: exact install, environment, database, development, test, and build instructions. Acceptance: commands satisfy Milestone 0 quality gates from a clean checkout.

## Milestone 1 — Domain engine

- [ ] **M1-001 — Implement canonical workload schemas.** Depends on: M0-003, M0-005. Output: Zod `WorkloadInput` schema and inferred TypeScript types for Quick and Advanced fields. Acceptance: valid examples pass and invalid ranges/enums fail in unit tests.
- [ ] **M1-002 — Create versioned assumption data and validation.** Depends on: M1-001. Output: `workload-v1.yaml`, schema loader, documented heuristic values, and version identifier. Acceptance: malformed or incomplete configuration fails fast.
- [ ] **M1-003 — Implement normalization and provenance.** Depends on: M1-002. Output: deterministic derivation of request rates, peak, egress, storage, availability target, and region preference with field provenance. Acceptance: user overrides take precedence and no magic heuristic is embedded in engine code.
- [ ] **M1-004 — Implement confidence and missing-information ranking.** Depends on: M1-003. Output: weighted confidence score/label and impact-ranked uncertainty list. Acceptance: user, derived, and default contributions plus thresholds are frozen in tests.
- [ ] **M1-005 — Implement budget constraint primitives.** Depends on: M1-001. Output: constraint result and violation contracts usable before/after cost calculation. Acceptance: satisfied, violated, and absent-budget cases are tested.
- [ ] **M1-006 — Freeze the reference normalization scenario.** Depends on: M1-003, M1-004. Output: fixture for 100,000 users, Europe, medium traffic, production availability, and balanced priority. Acceptance: normalized values, assumptions, provenance, confidence, and missing information are deterministic.
- [ ] **M1-007 — Pass Milestone 1 quality gates.** Depends on: M1-005, M1-006. Output: clean checks and updated implementation status. Acceptance: a Quick Mode input returns the complete normalized result without cloud APIs.

## Milestone 2 — Semantic cloud catalog

- [ ] **M2-001 — Define catalog schemas and loaders.** Depends on: M1-001, M0-003. Output: validated YAML schemas for capabilities, providers, regions, patterns, and catalog version. Acceptance: invalid references and duplicate IDs fail fast.
- [ ] **M2-002 — Curate initial capabilities and service mappings.** Depends on: M2-001, SPIKE-B2. Output: AWS/Azure/GCP mappings for compute VM, managed PostgreSQL, object storage, load balancer, and applicable CDN. Acceptance: provider differences/caveats are retained and no mapping claims identity.
- [ ] **M2-003 — Curate validated launch regions.** Depends on: M2-001, SPIKE-B1. Output: region records and geography-to-region selection rules. Acceptance: only evidenced service/SKU combinations are selectable; no geographic-distance latency claim is emitted.
- [ ] **M2-004 — Define the VM plus managed PostgreSQL pattern.** Depends on: M2-002, M2-003. Output: `vm-managed-postgres` requirements and component graph. Acceptance: pattern is provider-neutral and supports the read-only Internet → load balancer → compute → PostgreSQL plus object storage view.
- [ ] **M2-005 — Generate three architecture candidates.** Depends on: M2-004, M1-003. Output: deterministic provider-specific candidates from one normalized workload. Acceptance: exactly one valid baseline candidate per provider contains region, services, capabilities, and caveats.
- [ ] **M2-006 — Pass Milestone 2 quality gates.** Depends on: M2-005. Output: catalog validation and candidate-generation tests plus status update. Acceptance: reference input produces three candidates without pricing.

## Milestone 3 — Pricing adapters

- [ ] **M3-001 — Implement pricing snapshot persistence.** Depends on: M0-004, SPIKE-A2. Output: migrations/repositories for snapshots, normalized records, source payload traceability, and retrieval timestamps. Acceptance: partial failed syncs cannot become the active snapshot.
- [ ] **M3-002 — Implement AWS adapter and parser tests.** Depends on: M3-001, SPIKE-A1. Output: paginated AWS fetcher plus frozen fixture parser. Acceptance: required baseline records normalize with correct units, region, SKU, and source.
- [ ] **M3-003 — Implement Azure adapter and parser tests.** Depends on: M3-001, SPIKE-A1. Output: paginated Azure Retail Prices fetcher plus frozen fixture parser. Acceptance: same normalized invariants as AWS are verified.
- [ ] **M3-004 — Implement GCP adapter and parser tests.** Depends on: M3-001, SPIKE-A1. Output: authenticated Cloud Billing Catalog fetcher plus frozen fixture parser. Acceptance: same normalized invariants are verified and missing credentials produce actionable errors.
- [ ] **M3-005 — Implement pricing sync CLI.** Depends on: M3-002, M3-003, M3-004. Output: `pnpm pricing:sync` and `--provider aws|azure|gcp`, logging, retries, and atomic activation. Acceptance: all-provider and individual runs are repeatable and report counts/gaps.
- [ ] **M3-006 — Verify baseline price coverage.** Depends on: M3-005, M2-005. Output: coverage report by provider, region, capability, and SKU. Acceptance: every candidate component has current public pricing or an explicit blocking gap.
- [ ] **M3-007 — Pass Milestone 3 quality gates.** Depends on: M3-006. Output: clean checks, fixture-only normal tests, and status update. Acceptance: local database contains a traceable active snapshot.

## Milestone 4 — Cost engine

- [ ] **M4-001 — Define cost calculation contracts.** Depends on: M3-001, M2-005. Output: estimate, status, line item, inclusion/exclusion, formula, and traceability schemas. Acceptance: unavailable data is representable without a fake total.
- [ ] **M4-002 — Implement compute and managed-database costs.** Depends on: M4-001, M3-006. Output: monthly compute, database compute, and database storage formulas. Acceptance: quantity, unit conversions, unit price, record ID, formula, and result are test-visible.
- [ ] **M4-003 — Implement storage, egress, and load-balancing costs.** Depends on: M4-001, SPIKE-C1, M3-006. Output: object storage, tiered public egress, and load-balancing formulas. Acceptance: free/tier boundaries and provider-specific units have boundary tests.
- [ ] **M4-004 — Assemble candidate estimates.** Depends on: M4-002, M4-003. Output: total, breakdown, included/excluded items, snapshot time, and confidence. Acceptance: missing required records propagate explicit unavailable status.
- [ ] **M4-005 — Pass Milestone 4 quality gates.** Depends on: M4-004. Output: formula/unit tests and status update. Acceptance: every reference candidate returns a traceable available or unavailable estimate.

## Milestone 5 — Recommendation engine and API

- [ ] **M5-001 — Implement versioned scoring configuration.** Depends on: M1-001. Output: validated `data/scoring/v1.yaml` with balanced, cost, reliability, and low-operations profiles. Acceptance: weights sum correctly and performance is absent.
- [ ] **M5-002 — Implement score dimensions and classification.** Depends on: M5-001, M4-004. Output: cost, reliability-fit, operational-simplicity, and portability scores with source/confidence/reasons. Acceptance: objective and heuristic inputs are never mislabeled.
- [ ] **M5-003 — Evaluate constraints against estimates.** Depends on: M1-005, M4-004. Output: explicit budget constraint results per candidate. Acceptance: expected and actual values are returned and remain separate from score.
- [ ] **M5-004 — Implement deterministic ranking and explanations.** Depends on: M5-002, M5-003. Output: ordered candidates, recommendation, reasons, caveats, runner-up trade-offs, and tie behavior. Acceptance: versions are fixed, violations are disclosed, and no provider is hardcoded to win.
- [ ] **M5-005 — Implement reference-data API endpoints.** Depends on: M0-002, M2-003. Output: health, providers, regions, and capabilities routes with Zod/OpenAPI. Acceptance: route integration tests match schemas.
- [ ] **M5-006 — Implement normalization and comparison endpoints.** Depends on: M1-007, M5-004, M5-005. Output: `POST /v1/workloads/normalize` and `POST /v1/compare`. Acceptance: responses contain input, normalized workload, candidates, recommendation, assumptions, missing information, confidence, and all version metadata.
- [ ] **M5-007 — Test error and unavailable-data paths.** Depends on: M5-006. Output: integration tests for invalid input, missing snapshot/record, constraint violations, and provider-specific gaps. Acceptance: errors and unavailable estimates are distinguishable and no fabricated price appears.
- [ ] **M5-008 — Pass Milestone 5 quality gates.** Depends on: M5-007. Output: clean checks, generated OpenAPI, deterministic API golden test, and status update. Acceptance: `/v1/compare` returns a complete comparison.

## Milestone 6 — Frontend

- [ ] **M6-001 — Build the Quick Mode form.** Depends on: M5-006. Output: accessible inputs for application, users, geography, traffic, availability, and priority. Acceptance: client/server validation uses canonical contracts and the reference scenario submits in under one minute.
- [ ] **M6-002 — Add Advanced Mode overrides.** Depends on: M6-001. Output: optional request, RPS, response, database, storage, egress, budget, managed-service, and lock-in controls. Acceptance: overrides preserve one canonical input model and show validation errors.
- [ ] **M6-003 — Build recommendation and provider summaries.** Depends on: M6-001. Output: recommended provider summary and three provider cards with cost/status, score, region, pattern, services, and constraints. Acceptance: unavailable estimates and violations remain visible.
- [ ] **M6-004 — Build comparison details.** Depends on: M6-003. Output: side-by-side table, cost line items/exclusions, score dimensions, and simple read-only architecture nodes. Acceptance: every displayed price and heuristic has inspectable origin/context.
- [ ] **M6-005 — Build explanation and uncertainty sections.** Depends on: M6-003. Output: reasons, runner-up trade-offs, caveats, assumptions/provenance, confidence, missing information, and pricing timestamp. Acceptance: core facts come from structured fields rather than parsed prose.
- [ ] **M6-006 — Add end-to-end browser coverage.** Depends on: M6-002, M6-004, M6-005. Output: Playwright reference-flow test. Acceptance: user submits Quick Mode, sees three candidates, opens costs, and inspects assumptions/confidence.
- [ ] **M6-007 — Pass Milestone 6 quality gates.** Depends on: M6-006. Output: clean checks including Playwright, accessibility review, and status update. Acceptance: a non-expert completes and understands the reference comparison.

## Milestone 7 — Validation and MVP completion

- [ ] **M7-001 — Freeze golden scenarios and datasets.** Depends on: M5-008. Output: 10k Europe/medium, 100k Europe/spiky/100 GB DB, and 500k North America/high-availability/budget workloads with pinned catalog, assumptions, scoring, and prices. Acceptance: repeated runs are identical without live APIs.
- [ ] **M7-002 — Compare against official calculators.** Depends on: M7-001, SPIKE-E2. Output: component-level Cloud Arena versus official-calculator report for three reference architectures. Acceptance: inputs, timestamps, exclusions, and discrepancies are reproducible.
- [ ] **M7-003 — Resolve material discrepancies.** Depends on: M7-002. Output: formula/parser fixes or documented justified exceptions. Acceptance: modeled components meet the agreed threshold or have an explicit limitation and owner.
- [ ] **M7-004 — Verify pricing-data compliance and attribution.** Depends on: SPIKE-D1, M6-005. Output: implemented notices/attribution and retention behavior where required. Acceptance: no unresolved public-launch blocker remains.
- [ ] **M7-005 — Run the MVP definition-of-done review.** Depends on: M6-007, M7-003, M7-004. Output: evidence for every outcome in `docs/product/mvp.md`. Acceptance: all required user/API behaviors pass, including overrides, constraints, traceability, confidence, and timestamps.
- [ ] **M7-006 — Publish known limitations and final status.** Depends on: M7-005. Output: current limitations, supported regions/SKUs, pricing freshness, exclusions, confidence caveats, and completed status. Acceptance: documentation matches actual behavior.
- [ ] **M7-007 — Pass release quality gates.** Depends on: M7-006. Output: clean format, lint, typecheck, unit, parser, integration, golden, E2E, build, and CI results. Acceptance: the VM plus managed PostgreSQL vertical slice is complete; post-MVP scope remains deferred.

## Deferred backlog

- [ ] **POST-001 — Add managed-container plus PostgreSQL candidates.** Depends on: M7-007. Output: a second validated cross-provider pattern. Acceptance: pricing/scoring compare provider and architecture pattern without weakening baseline correctness.
- [ ] **POST-002 — Add sensitivity analysis.** Depends on: POST-001. Output: workload/weight/budget thresholds where recommendations change. Acceptance: results explain the conditions under which each alternative wins.
- [ ] **POST-003 — Evaluate later roadmap items.** Depends on: M7-007. Output: separately approved plans for serverless, regions, data services, commitments, performance methodology, multi-region, providers, Terraform, CLI, MCP, and AI consumers. Acceptance: none enter MVP implicitly.

