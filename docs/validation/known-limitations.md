# MVP known limitations and release status

Last reviewed: 2026-08-27. Status: **validation implemented; public release
blocked**.

- Only the single-region `vm-managed-postgres` pattern and the cataloged Europe,
  North America, and South America defaults are supported.
- Estimates cover compute, managed PostgreSQL compute/storage, object capacity,
  Layer 7 load balancing, and public egress. The UI lists all exclusions.
- Prices are USD public on-demand/list rates. Taxes, discounts, commitments,
  credits, support, and negotiated pricing are excluded.
- A price is available only from an active traceable snapshot. Freshness is
  classified at 24/48/72 hours; no stale or missing value is fabricated.
- GCP live estimates remain unavailable until authenticated Catalog evidence and
  selectors are completed.
- Golden rates are deterministic test data, not current price claims and not a
  replacement for live snapshots or calculator evidence.
- Official-calculator validation has nine invalid comparisons pending captured
  exports; no deviation or exception has been inferred.
- Public pricing presentation remains blocked by `LEGAL-PRICING-001` until the
  recorded provider-specific legal/permission review is complete.
- Reliability fit, operational simplicity, and portability are disclosed
  versioned heuristics. Cross-provider performance and latency are not scored.
- Authentication, accounts, deployment generation, multi-region, commitments,
  performance benchmarking, and the rest of the documented non-goals remain
  post-MVP.

Release quality gates may be run with `pnpm check && pnpm test:e2e`. The golden
suite is part of the API tests. A green command proves repository health, not
closure of the three external blockers above.
