# API Contract

Cloud Arena is API-first. Domain logic must not be hidden in frontend server actions, and the web application consumes the same structured comparison contract intended for future CLI, agent, MCP, IDE, and application consumers.

## Initial endpoints

| Method | Path | Responsibility |
| --- | --- | --- |
| `GET` | `/health` | Report API readiness. |
| `GET` | `/v1/providers` | List supported providers and availability metadata. |
| `GET` | `/v1/regions` | List curated supported regions/geographies. |
| `GET` | `/v1/capabilities` | List provider-neutral capabilities and mappings suitable for public exposure. |
| `POST` | `/v1/workloads/normalize` | Validate input and return normalized workload, assumptions, provenance, missing information, and confidence. |
| `POST` | `/v1/compare` | Generate candidates, estimate costs, evaluate constraints, score/rank alternatives, and return the comparison. |
| `GET` | `/openapi.json` | Return the generated OpenAPI 3.1 contract for implemented routes. |

An internal pricing synchronization endpoint may be added for development, but the initial operational interface is a CLI rather than public HTTP.

## Contract rules

- Zod schemas provide runtime validation and OpenAPI generation.
- [Domain model](domain-model.md) defines response responsibilities.
- Structured fields are authoritative; explanation prose is derived from them.
- Every comparison identifies catalog, assumptions, scoring, and pricing snapshot versions.
- All three providers remain visible even if one has a constraint violation or unavailable pricing.
- Pricing failures are explicit. The API never silently substitutes invented values.
- Validation errors return HTTP 400 with `VALIDATION_ERROR` and field issues. Internal failures return HTTP 500 with `INTERNAL_ERROR`. Unavailable pricing remains a successful structured comparison with unavailable estimates and, when no candidate is complete, an unavailable recommendation.
- Endpoint behavior is deterministic for identical input and dataset/configuration versions.

## Comparison responsibilities

`POST /v1/compare` accepts the canonical workload input used by both UI modes. It returns original input, normalized workload, candidates, recommendation, assumptions, missing information, confidence, and version metadata.

Cost details expose modeled components, exclusions, snapshot time, and traceable line items. Scores expose dimension, weight, origin, confidence, and reasons. Constraint violations expose expected versus actual values independently of total score.

OpenAPI documentation is generated from implemented schemas and checked for drift in integration tests.

The production server reads active provider snapshots from PostgreSQL. Tests inject frozen snapshot readers, so ordinary tests never require a database or live cloud API.
