# Assumptions, Provenance, and Confidence

## Versioned heuristics

Workload heuristics live in a versioned file such as `data/assumptions/workload-v1.yaml`; magic numbers must not be scattered through code. The initial configuration derives values such as requests per user per day and peak multipliers by traffic profile.

Initial values are product heuristics, not industry facts. Each must be documented, exposed in results, and overridable through Advanced Mode.

`workload-v1` freezes the following initial values:

| Input | Requests/user/day | Peak multiplier |
| --- | ---: | ---: |
| Low traffic | 5 | 2x |
| Medium traffic | 20 | 3x |
| High traffic | 40 | 4x |
| Spiky traffic | 20 | 10x |

- Calendar normalization uses 30 days per month and 86,400 seconds per day.
- Average response size defaults to 50 KB.
- Database storage is the greater of 20 GB or 1 GB per 1,000 monthly users.
- Object storage is the greater of 100 GB or 5 GB per 1,000 monthly users.
- Public egress is derived from monthly requests multiplied by average response KB, using 1,000,000 KB per GB. It models response payload only.
- Availability targets are 99% for standard, 99.9% for production, 99.95% for high, and 99.99% for mission-critical.
- Europe, North America, and South America map to provider-neutral regional preferences; provider regions are selected later by the catalog.

## Resolution order

For each normalized field:

1. Use a valid explicit user value when provided.
2. Derive the value from user input and documented rules when possible.
3. Apply a versioned default only when necessary.
4. Record missing information when an absent value materially affects confidence.

The result records `user`, `derived`, or `default` provenance and a concise explanation. Provider pricing and architecture-rule sources are separately identified in downstream estimates and scores.

## Confidence model

Confidence is a deterministic weighted heuristic, not probabilistic or AI confidence. Important variables include request volume, egress, database size, geography, availability, and storage.

- User-provided value: `1.0`.
- Derived value: approximately `0.6`.
- Default assumption: approximately `0.3`.

Actual weights and contributions are versioned and tested. The engine computes a `0..1` total and maps it to Low, Medium, or High. Thresholds must be declared in configuration before tests are frozen.

For `workload-v1`, request volume, peak RPS, and egress weigh 20% each; database storage weighs 15%; average response size weighs 10%; and object storage, geography, and availability weigh 5% each. Scores below 0.5 are Low, scores from 0.5 to below 0.8 are Medium, and scores of 0.8 or greater are High.

Results rank the largest uncertainty sources by impact, for example missing egress and peak RPS as high-impact inputs and database size as medium-impact.

## Overrides and auditability

Advanced Mode overrides do not alter the versioned dataset. They change provenance to user-provided and improve confidence according to configured weights. Results retain the assumption version even when individual fields are overridden.

Golden scenarios freeze inputs, assumption versions, and expected normalized values to detect accidental changes.
