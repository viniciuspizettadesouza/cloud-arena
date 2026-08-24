# Pricing Sources and Research Spikes

## Authoritative inputs

- AWS: [AWS Price List/Billing and Cost Management APIs](https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/Welcome.html).
- Azure: [Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices), a public source without authentication.
- Google Cloud: [Cloud Billing Catalog API](https://docs.cloud.google.com/billing/v1/how-tos/catalog-api) for services, SKUs, metadata, and regions; configured API access is required.
- Normalization reference: [FOCUS specification](https://focus.finops.org/focus-specification/), using FOCUS-inspired names without claiming compliance.
- Availability evidence may use the [Azure Compute Resource SKUs API](https://learn.microsoft.com/en-us/rest/api/compute/resource-skus/list) and provider catalog metadata.

Official provider behavior is authoritative. Any discrepancy with the foundational brief must be documented.

## MVP pricing boundary

Use USD public on-demand/list pricing only. Defer enterprise agreements, private discounts, taxes, currency conversion, reserved/commitment optimization, Savings Plans, CUDs, and Spot. The normalized schema can represent future models without implementing them.

Pricing synchronizes into local snapshots rather than being fetched during comparisons. Raw records are retained for traceability/debugging, and sanitized fixtures support deterministic parser tests.

## Required traceability

Every displayed amount resolves to provider, service, SKU, region, unit, unit price, snapshot time, usage quantity, and formula. Estimates show compute, database compute/storage, object storage, egress, and load balancing separately, plus modeled and excluded items.

If a required record is missing or stale beyond an established policy, report pricing as unavailable. Never fabricate a substitute.

## Technical spikes

### A. Pricing APIs

Fetch representative baseline records from all providers, store sanitized fixtures, and document source fields and normalization mappings.

### B. Service availability

Validate exact SKUs and components in launch regions. A listed price alone does not prove deployability.

### C. Network egress

Document only public internet egress tiers required by launch scenarios, including relevant boundaries.

### D. Data-use policy

Record terms governing caching, storage, redistribution, and attribution before public launch.

### E. Calculator validation

Build three representative architectures in official calculators, compare modeled components, record discrepancies, and set the acceptable deviation threshold before MVP completion.

These spikes are the first implementation tasks, not a separate market-research phase.

## Spike results

- [SPIKE-A1 representative pricing records](pricing-api-records.md) — AWS and Azure captured on 2026-08-24; the evidenced GCP credential failure is retained and authenticated capture is deferred to SPIKE-A1-GCP.
- [SPIKE-A2 pricing normalization mappings](pricing-normalization.md) — AWS and Azure fixture-mapped; GCP schema-mapped with exact SKU selection and units explicitly unresolved under SPIKE-A1-GCP.
- [SPIKE-A3 pricing synchronization policy](pricing-sync-policy.md) — pagination/download behavior, bounded retries, atomic activation, failure states, and versioned 24/48/72-hour freshness rules.
- [SPIKE-B1 launch regions and services](launch-regions-services.md) — three deterministic region trios, baseline service configurations, availability modes, evidence, and catalog validation rules.
- [SPIKE-B2 networking components](networking-components.md) — Layer 7 load-balancer selections and an explicit no-CDN baseline decision.
- [SPIKE-C1 public internet egress](public-egress.md) — frozen formulas, provider units, free allowances, exact launch-geography tiers, and boundary fixtures.
- [SPIKE-D1 pricing-data usage policy](pricing-data-usage.md) — conservative caching, retention, redistribution, attribution, and public-launch controls with an explicit legal-review blocker.
- [SPIKE-E1 calculator reference architectures](calculator-reference-architectures.md) — three frozen workloads, exact provider-calculator selections, common comparison scope, and exclusions.
- [SPIKE-E2 cost-deviation policy](cost-deviation-policy.md) — approved 2% component/total thresholds with absolute floors, comparison preconditions, triage, and exception rules.
