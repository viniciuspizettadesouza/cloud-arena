# ADR-002: API-first architecture

- Status: Accepted
- Date: 2026-08-24

## Context

The web UI is only the first consumer. Future consumers may include CLI tools, agents, MCP, IDE extensions, and other applications.

## Decision

Expose normalization and comparison through a versioned HTTP API backed by shared Zod contracts and OpenAPI. Do not hide domain behavior in frontend server actions. Structured JSON is authoritative; human explanations derive from it.

## Consequences

Web and future clients share semantics. Contract integration tests and version metadata are required, while MCP and other clients remain outside MVP scope.

