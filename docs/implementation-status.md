# Implementation Status

Last updated: 2026-08-24

## Completed

- Preserved the foundational implementation brief.
- Created product, MVP, architecture, domain, API, assumptions, scoring, research, and ADR documentation.
- Created the ordered implementation plan and detailed checkbox backlog.

## In progress

- Nothing. Documentation bootstrap is complete.

## Next

1. Begin technical spikes A–E.
2. Record verified provider facts and unresolved discrepancies.
3. Start Milestone 0 after spike requirements for fixtures and tooling are understood.

## Known limitations

- No application, workspace, API, UI, database schema, catalog data, or test suite exists yet.
- Initial heuristic values, confidence weights/thresholds, launch SKUs, exact regions, network components, egress formulas, pricing-data policy, and calculator deviation threshold require implementation research.
- Competitor notes are directional and require revalidation before public use.

## Technical decisions

- Provider-neutral domain and adapter boundaries.
- API-first structured results.
- Deterministic engine with versioned inputs and no MVP LLM dependency.
- Locally synchronized pricing snapshots.
- Version-controlled YAML semantic knowledge.
- USD public on-demand/list pricing only for MVP.

See the [ADR index](adr/README.md) for rationale and consequences.

