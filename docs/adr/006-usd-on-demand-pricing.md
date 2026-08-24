# ADR-006: USD public on-demand pricing for MVP

- Status: Accepted
- Date: 2026-08-24

## Context

Private contracts, commitments, Spot, taxes, and currency conversion would greatly expand comparison complexity before the core normalization problem is validated.

## Decision

Estimate only USD public on-demand/list prices in the MVP. Model and display included and excluded items. Keep normalized schemas extensible to other pricing models.

## Consequences

Results are estimates rather than bills and may differ materially from negotiated costs. The UI and API must state exclusions and never imply private-price optimization.

