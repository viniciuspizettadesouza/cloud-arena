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

