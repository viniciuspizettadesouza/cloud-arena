# MVP definition-of-done review

Review date: 2026-08-27. Release decision: **not ready for public launch**.

## Implemented evidence

The three pinned golden scenarios exercise one candidate per provider, complete
component costs, constraints (including the budget case), deterministic ranking,
reasons and trade-offs, assumptions, confidence, missing information, advanced
overrides, API version metadata, pricing snapshot IDs, and retrieval timestamps.
Repeated API runs are byte-identical and protected by SHA-256 assertions.

The browser flow covers the Quick Mode submission, all provider cards, pricing
gaps, cost inspection, assumptions/confidence, canonical validation, and the new
provider attribution/calculator links. Unit and integration suites cover advanced
override precedence, available and unavailable estimates, constraints, parser
behavior, and failure paths.

These tests provide implementation evidence for the fifteen outcomes in
[`docs/product/mvp.md`](../product/mvp.md), but they do not establish public
release readiness because validation and compliance prerequisites remain open.

## Blocking evidence

- `CALCULATOR-EVIDENCE-MISSING`: all nine official-calculator cells remain
  invalid, so material discrepancy resolution has not begun.
- `SPIKE-A1-GCP` / `M3-004`: no authenticated, verified GCP pricing fixture or
  live selector exists.
- `LEGAL-PRICING-001`: no qualified legal review or written provider permission
  covering the production data flow is recorded.

The application now displays narrow derived-estimate disclaimers, official
pricing/calculator links, snapshot IDs, timestamps, inclusions, and exclusions.
The database implements deletion of raw payloads older than 90 days and inactive
normalized snapshots older than 13 months through `pnpm pricing:prune`. Those
controls reduce risk but do not substitute for legal clearance.
