# ADR-003: Deterministic recommendation engine

- Status: Accepted
- Date: 2026-08-24

## Context

Trustworthy architecture decisions require reproducibility and explanations. LLM behavior would undermine those properties in the MVP.

## Decision

For the same input, pricing snapshot, catalog, assumptions, and scoring versions, return the same result. Use explicit normalization rules, cost formulas, constraints, and weighted scoring. Do not place an LLM in the recommendation path.

## Consequences

All datasets and heuristics require versions and tests. AI may consume the API later, but cannot be the source of core facts or decisions in the MVP.

