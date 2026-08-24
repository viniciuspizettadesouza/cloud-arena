# Public internet egress model

Status: accepted for the MVP on 2026-08-25. GCP Catalog SKU identifiers remain
deferred to `SPIKE-A1-GCP`; the public pricing rules below are sufficient to
freeze the calculation behavior.

## Scope and common assumptions

- `monthlyEgressGB` is decimal gigabytes (`1 GB = 1,000,000,000 bytes`).
- The value represents total application-response traffic delivered to the
  public internet. Object downloads routed through the application are already
  included; a separate direct-object-download input must not be added to the
  same estimate.
- The destination is assumed to be in the workload's selected geography. The
  UI must disclose this derived assumption until destination mix is an Advanced
  Mode input.
- CDN traffic is excluded from the MVP baseline, as decided in
  [networking-components.md](networking-components.md).
- Prices are USD, pay-as-you-go/list prices, without taxes, contracts, credits,
  or negotiated discounts.
- Free allowances are account-wide. An estimate assumes the full allowance is
  available to this workload and must disclose that assumption.

The provider quantity is:

```text
AWS/Azure quantity = monthlyEgressGB
GCP quantity GiB   = monthlyEgressGB * 1,000,000,000 / 1,073,741,824
```

For ordered half-open tiers `[start, end)` with rate `r`, calculate:

```text
tierUsage(q, start, end) = max(0, min(q, end) - start)
tierCost                  = tierUsage * r
total                     = sum(tierCost), rounded to cents only for display
```

An absent upper bound means infinity. Internal arithmetic must retain decimal
precision and must not round each tier to cents.

## Frozen launch rules

### AWS

AWS provides 100 GB of internet data transfer out per month at no charge,
aggregated across eligible AWS services and Regions. The regional Price List
CSV describes the paid tiers as traffic "beyond the global free tier". Apply
the allowance first, then evaluate `q = max(0, monthlyEgressGB - 100)`.

| Launch geography | Source Region | Paid quantity range (GB) | USD/GB |
| --- | --- | ---: | ---: |
| Europe | `eu-west-1` | 0–10,240 | 0.090 |
| Europe | `eu-west-1` | 10,240–51,200 | 0.085 |
| Europe | `eu-west-1` | 51,200–153,600 | 0.070 |
| Europe | `eu-west-1` | 153,600+ | 0.050 |
| North America | `us-east-1` | 0–10,240 | 0.090 |
| North America | `us-east-1` | 10,240–51,200 | 0.085 |
| North America | `us-east-1` | 51,200–153,600 | 0.070 |
| North America | `us-east-1` | 153,600+ | 0.050 |
| South America | `sa-east-1` | 0–10,240 | 0.150 |
| South America | `sa-east-1` | 10,240–51,200 | 0.138 |
| South America | `sa-east-1` | 51,200–153,600 | 0.126 |
| South America | `sa-east-1` | 153,600+ | 0.114 |

Sources: [AWS EC2 data-transfer pricing](https://aws.amazon.com/ec2/pricing/on-demand/)
and the public regional AWS Data Transfer Price List CSVs retrieved on
2026-08-25. The captured Europe record is in
`packages/providers/aws/test/fixtures/representative-prices.json`; North and
South America were verified against the equivalent `us-east-1` and
`sa-east-1` regional CSVs.

### Azure

Use Internet Egress routed via the Microsoft Premium Global Network, matching
the premium-network baseline selected for the other providers. Apply the tiers
directly to `monthlyEgressGB`.

| Launch geography | Source Region | Quantity range (GB) | USD/GB |
| --- | --- | ---: | ---: |
| Europe | `westeurope` | 0–100 | 0.000 |
| Europe | `westeurope` | 100–10,335 | 0.087 |
| Europe | `westeurope` | 10,335–51,295 | 0.083 |
| Europe | `westeurope` | 51,295–153,695 | 0.070 |
| Europe | `westeurope` | 153,695+ | 0.050 |
| North America | `eastus` | 0–100 | 0.000 |
| North America | `eastus` | 100–10,335 | 0.087 |
| North America | `eastus` | 10,335–51,295 | 0.083 |
| North America | `eastus` | 51,295–153,695 | 0.070 |
| North America | `eastus` | 153,695+ | 0.050 |
| South America | `brazilsouth` | 0–100 | 0.000 |
| South America | `brazilsouth` | 100–10,335 | 0.181 |
| South America | `brazilsouth` | 10,335–51,295 | 0.175 |
| South America | `brazilsouth` | 51,295–153,695 | 0.170 |
| South America | `brazilsouth` | 153,695+ | 0.160 |

The marketing page labels these bands as 100 GB, then 10/40/100/350 TB. The
Retail Prices API returns exact `tierMinimumUnits` of 0, 100, 10,335, 51,295,
153,695, and 512,095 for meter `Standard Data Transfer Out`, product
`Rtn Preference: MGN`. The engine must use the API boundaries rather than
reconstructing them from labels. The repeated terminal rate at 512,095 does not
change the formula and is intentionally collapsed above.

Sources: [Azure bandwidth pricing](https://azure.microsoft.com/en-us/pricing/details/bandwidth/)
and [Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices),
queried for all three launch Regions on 2026-08-25.

### GCP

Use Premium Tier internet data transfer, which is the default and matches the
global external Application Load Balancer choice. GCP bills this surface per
GiB and by destination. Apply the common GB-to-GiB conversion before evaluating
the table.

| Destination geography | Quantity range (GiB) | USD/GiB |
| --- | ---: | ---: |
| Europe | 0–1 | 0.000 |
| Europe | 1–1,024 | 0.120 |
| Europe | 1,024–10,240 | 0.110 |
| Europe | 10,240+ | 0.085 |
| North America | 0–1 | 0.000 |
| North America | 1–1,024 | 0.120 |
| North America | 1,024–10,240 | 0.110 |
| North America | 10,240+ | 0.080 |
| South America | 0–1,024 | 0.190 |
| South America | 1,024–10,240 | 0.180 |
| South America | 10,240+ | 0.150 |

The South America destination tier has no 1 GiB free tier. GCP counts monthly
usage per SKU, so the later authenticated Catalog mapping must retain the
destination-specific SKU rather than pooling unrelated SKUs.

Source: [Google Cloud VPC network pricing](https://cloud.google.com/vpc/pricing).

## Boundary fixture contract

[`fixtures/public-egress-boundaries.json`](fixtures/public-egress-boundaries.json)
freezes the tiers and creates a below/at/above case for every distinct boundary.
Cost-engine tests must load this fixture and assert:

1. cost continuity at every boundary;
2. zero cost throughout each free tier;
3. the marginal cost immediately above a boundary uses the new rate;
4. AWS's global allowance is subtracted before its paid tier table;
5. GCP input is converted from decimal GB to GiB exactly once.

## Explicit exclusions and follow-up

- Cross-Region, inter-zone, NAT, CDN, acceleration, peering, and dedicated-link
  transfer are not included.
- Database replication traffic implied by a provider HA option is assumed to be
  included in that service's public list-price model unless a later price record
  proves otherwise.
- Traffic destination mix is not inferred. If a user supplies no destination,
  same-geography delivery remains a visible assumption.
- `SPIKE-A1-GCP` must replace the public-table GCP selectors with authenticated
  service/SKU evidence before `M3-004`; it must not silently change these frozen
  formulas without updating this decision and its fixtures.
