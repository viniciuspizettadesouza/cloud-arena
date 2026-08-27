# Cost engine

Status: implemented as `cost-v1` on 2026-08-27.

The `@cloud-arena/cost` package converts a normalized workload, an architecture
candidate, and that provider's active pricing snapshot into a deterministic
`CostEstimate`. It never calls a provider API and never substitutes a missing
price with zero. The database exposes active snapshots through
`PostgresActivePricingSnapshotReader`; callers can also supply frozen snapshots
for repeatable tests and later golden scenarios.

## Calculation conventions

- Continuously provisioned resources use 730 hours per month.
- Compute cost is candidate instance quantity × 730 × hourly unit price.
- Managed-database compute uses the candidate deployment option. AWS selects a
  Single-AZ or Multi-AZ source record; Azure and GCP apply a factor of two to
  hourly compute for the high-availability standby.
- Database and object storage use the normalized workload quantities. Decimal
  GB is converted to GiB only when the price record's canonical unit requires
  it.
- Tiered storage and egress use half-open tiers without per-tier cent rounding.
- AWS public egress subtracts the frozen 100 GB global allowance before applying
  paid tiers. Azure prices the original quantity against its explicit free
  tier. GCP converts decimal GB to GiB once before applying its tiers.
- Load-balancer processed volume is response egress plus a disclosed 1 KB per
  request request-body assumption. AWS uses one processed GB per LCU-hour.
  Azure `cost-v1` freezes one average capacity unit per 1,530 processed GB per
  month, with a one-unit minimum, matching the accepted reference scenarios.
  GCP uses forwarding-rule hours plus processed GiB when those records exist.

Arithmetic is performed as exact rational values built from the workload and
source decimal strings. Values are converted to JavaScript numbers only at the
public contract boundary. Display clients may round currency to cents; the
engine does not round intermediate tiers or line items.

## Availability and traceability

An available estimate contains all six stable line items: compute, database
compute, database storage, object storage, load balancing, and public egress.
Every line item includes its formula and the persisted price-record/snapshot,
provider, service, SKU, region, unit, unit price, source price identity, source,
retrieval time, and tier bounds.

If a required category is absent, ambiguous, has incompatible units, or has
invalid tier continuity, the estimate is `unavailable`, omits the total, and
returns explicit gaps. Successfully priced line items remain visible for
diagnosis. Cost confidence is the normalized-workload confidence for a complete
estimate and zero for an incomplete one.

The modeled inclusions and exclusions are structured fields on every estimate.
They retain the MVP exclusions for disks/backups, storage operations, DNS,
security/network add-ons, support, taxes, discounts, commitments, and the
candidate's excluded CDN mapping.
