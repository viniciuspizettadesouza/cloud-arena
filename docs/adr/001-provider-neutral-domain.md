# ADR-001: Provider-neutral domain model

- Status: Accepted
- Date: 2026-08-24

## Context

Cloud Arena compares providers and must support additional providers and architecture patterns without rebuilding its core around one cloud’s products.

## Decision

Express architecture through provider-neutral capabilities and patterns. Keep service mappings and external API behavior in catalog/provider adapters. A mapping means “implements the same Cloud Arena capability,” not “identical product.”

The domain package cannot depend on provider SDKs or application frameworks.

## Consequences

Semantic equivalence becomes curated domain knowledge. Provider-specific differences must remain visible as attributes, caveats, availability, and cost rather than leaking into the core model.

