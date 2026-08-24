# Official-calculator cost-deviation policy

Status: policy v1 accepted for `SPIKE-E2` on 2026-08-25. It applies to the
modeled MVP components in
[calculator-reference-architectures.md](calculator-reference-architectures.md)
and is machine-readable in
[`fixtures/cost-deviation-policy.json`](fixtures/cost-deviation-policy.json).

## Purpose

Official calculators are an independent cross-check, not the source used by the
Cloud Arena engine. The comparison is intended to catch selector, unit, tier,
quantity, and formula errors that can otherwise produce plausible totals.

Passing this policy does not claim invoice accuracy or performance equivalence.

## Preconditions

A comparison run is valid only when:

1. it uses one frozen E1 scenario without changing its quantities;
2. Cloud Arena and the official calculator use USD public on-demand/list price;
3. the Cloud Arena snapshot was retrieved no more than 24 hours before the
   calculator run, unless both expose the same explicit effective price date;
4. both sides use 730 monthly hours and the same Region, machine/database mode,
   storage quantity, load-balancer usage, and egress destination;
5. calculator share/export evidence and Cloud Arena trace output are retained;
6. included and excluded items are mapped before totals are compared.

A precondition failure yields `invalid-comparison`, not pass, fail, or an
exception.

## Component comparison

Map calculator rows to the six stable line items. Several calculator rows may
sum into one stable item, but one row must not be allocated across multiple
items without a documented deterministic rule.

For calculator reference `R` and Cloud Arena value `A`:

```text
signedDeltaUSD = A - R
absoluteDeltaUSD = abs(A - R)
relativeDelta = absoluteDeltaUSD / abs(R), when abs(R) >= 0.01
```

A component passes when:

```text
absoluteDeltaUSD <= max(1.00 USD, 0.02 * abs(R))
```

If `abs(R) < 0.01`, both values must be below USD 0.01. This avoids meaningless
percentage errors around zero while still detecting a wrongly added charge.

## Total comparison

Sum only the six mapped, modeled line items on both sides. Do not compare a
calculator grand total containing support, boot disks, backup, tax, or another
excluded item against the Cloud Arena modeled subtotal.

The modeled total passes when:

```text
absoluteDeltaUSD <= max(5.00 USD, 0.02 * abs(referenceModeledTotal))
```

A scenario/provider result passes only when every required component and the
modeled total pass. A missing line item, unavailable Cloud Arena price, stale
snapshot, or unmapped calculator charge cannot be converted to zero.

The 2% threshold is deliberately tight because the two sides use the same
frozen quantities and public list-price basis. The absolute floors accommodate
calculator display rounding and very small line items. The threshold may be
changed only by a new version of this policy before reviewing results—not after
seeing a failing comparison.

## Triage

For any failed line, investigate in this order:

1. Region, service, SKU/edition, operating system, tenancy, and availability
   mode selection;
2. hours, resource count, storage/traffic unit, and GB/GiB conversion;
3. free allowance and tier-boundary treatment;
4. calculator-included default or mandatory subcomponent;
5. price effective date and price-source freshness;
6. parser, normalization, or cost-formula defect.

Fix defects and rerun all affected scenarios. Preserve the failing report as
regression evidence.

## Exceptions

An exception is allowed only for a confirmed, irreducible difference in official
calculator behavior or a deliberately excluded MVP charge. It cannot excuse an
unknown cause, stale data, unavailable price, selector mismatch, arithmetic
error, or a change made solely to obtain a pass.

Each exception record must contain:

- stable ID, status, scenario, provider, and line item;
- Cloud Arena value, calculator value, signed/absolute/relative deltas;
- exact calculator inputs/export and price-snapshot identifiers;
- root cause with primary-source evidence;
- why correction is impossible or outside the approved MVP surface;
- user-visible limitation text;
- owner, approver, approval date, review/expiry date, and remediation task.

Allowed statuses are `proposed`, `approved`, `expired`, and `resolved`.
`proposed` or `expired` exceptions still block `M7-003`. An approved exception
does not turn the numeric result into a pass; reports show
`accepted-exception`, and the raw discrepancy remains visible.

## Milestone 7 acceptance

`M7-002` produces 9 scenario/provider reports and a summary matrix. `M7-003` is
complete only when every cell is either:

- `pass` under both component and total thresholds; or
- `accepted-exception` with all required fields, a user-visible limitation, and
  an unexpired approval.

The release report must include pass counts, exceptions, invalid comparisons,
largest deltas, source timestamps, and links to calculator/trace evidence.
