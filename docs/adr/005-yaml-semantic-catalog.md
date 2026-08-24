# ADR-005: Version-controlled YAML semantic catalog

- Status: Accepted
- Date: 2026-08-24

## Context

Provider pricing catalogs do not define Cloud Arena’s semantic equivalence or architecture intent.

## Decision

Store capabilities, provider service mappings, regions, architecture patterns, workload assumptions, and scoring weights in version-controlled YAML. External APIs enrich pricing and availability but do not define equivalence.

## Consequences

Changes are reviewable and auditable, and results cite catalog/configuration versions. Schemas and validation are required to prevent malformed data.

