# ADR-004: Pricing snapshot strategy

- Status: Accepted
- Date: 2026-08-24

## Context

Live provider requests during comparisons would make latency, availability, and reproducibility depend on external APIs.

## Decision

Synchronize provider prices through adapters into normalized, timestamped local snapshots. Comparison requests read local data. Retain raw records for debugging and frozen sanitized fixtures for parser tests.

Missing required prices produce an explicit unavailable status; no fabricated fallback is allowed.

## Consequences

The project needs sync tooling, snapshot storage, freshness policy, traceability, and operational monitoring later. Deterministic golden tests can pin a snapshot.

