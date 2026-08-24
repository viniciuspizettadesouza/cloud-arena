# Architecture Overview

## System flow

```text
WorkloadInput
  -> normalization and versioned assumptions
  -> NormalizedWorkload plus provenance/confidence
  -> provider-neutral architecture pattern
  -> provider-specific candidates from semantic catalog
  -> local normalized pricing snapshot
  -> cost estimates
  -> hard-constraint evaluation
  -> versioned scoring and ranking
  -> structured ComparisonResult
  -> API consumers, including the web UI
```

Human-readable explanations are derived from structured facts. The structured JSON is authoritative.

## Planned monorepo

```text
apps/
  web/
  api/
packages/
  domain/
  contracts/
  catalog/
  assumptions/
  pricing/
  recommendation/
  scoring/
  providers/
    aws/
    azure/
    gcp/
  database/
data/
  assumptions/
  scoring/
  catalog/
  regions/
  architecture-patterns/
docs/
scripts/
docker-compose.yml
```

Semantic catalog and heuristic configuration remain version-controlled YAML for auditability. PostgreSQL initially stores pricing snapshots, pricing records, cloud services, and cloud regions. Comparisons and users are not persisted unless a concrete technical need emerges.

## Dependency boundaries

The domain is framework- and provider-independent. It must not import React, Fastify, Drizzle, or cloud SDKs. Contracts use domain types and Zod schemas. Catalog, assumptions, pricing, scoring, and recommendation implement domain behavior. Provider packages translate external data and service concepts. API composition depends on these packages; the web consumes the API rather than owning business logic.

Provider selection must be data/adapter driven, not a growing collection of provider conditionals in the engine.

## Architecture patterns and capabilities

Initial capabilities are `compute.vm`, `database.postgresql.managed`, `storage.object`, `network.load-balancer`, and `network.cdn`. The first pattern maps these to EC2/RDS/S3/load balancing/CloudFront; Azure VMs/Azure Database for PostgreSQL/Blob Storage/appropriate load balancing and CDN; and Compute Engine/Cloud SQL/Cloud Storage/Cloud Load Balancing/Cloud CDN.

Networking choices and service availability must be validated by spikes. Semantic mappings assert comparable capability, not product identity.

## Pricing snapshots

```text
provider APIs -> provider adapters -> normalized pricing snapshot -> local database
```

Comparisons query local snapshots and never depend on a live provider response. The planned CLI supports all-provider and per-provider synchronization. Raw provider records remain available for debugging, and parsers use sanitized frozen fixtures.

Every displayed price must be traceable to provider, service, SKU, region, unit, unit price, snapshot, and cost formula. Missing data produces `unavailable`, never an invented price.

## Reliability and future evolution

The separated normalization, candidate generation, pricing, constraints, and scoring stages preserve determinism and support future sensitivity analysis. The MVP does not claim real latency or objective performance. Additional patterns are introduced only after the baseline pricing path is trustworthy.

