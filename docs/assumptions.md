# Assumptions, Provenance, and Confidence

## Versioned heuristics

Workload heuristics live in a versioned file such as `data/assumptions/workload-v1.yaml`; magic numbers must not be scattered through code. The initial configuration derives values such as requests per user per day and peak multipliers by traffic profile.

Initial values are product heuristics, not industry facts. Each must be documented, exposed in results, and overridable through Advanced Mode.

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

Results rank the largest uncertainty sources by impact, for example missing egress and peak RPS as high-impact inputs and database size as medium-impact.

## Overrides and auditability

Advanced Mode overrides do not alter the versioned dataset. They change provenance to user-provided and improve confidence according to configured weights. Results retain the assumption version even when individual fields are overridden.

Golden scenarios freeze inputs, assumption versions, and expected normalized values to detect accidental changes.

