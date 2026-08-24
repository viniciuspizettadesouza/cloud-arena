# MVP Definition

## Goal

A user describes a greenfield Web API/SaaS workload in under one minute and receives one comparable AWS, Azure, and GCP architecture with estimated monthly cost, ranking, explanations, assumptions, missing information, and confidence.

## Supported scope

- Providers: AWS, Microsoft Azure, and Google Cloud Platform.
- Workload: Web API/SaaS with PostgreSQL, object storage, HTTP traffic, and one primary region.
- First pattern: VM plus managed PostgreSQL.
- Initial geographies: Europe, North America, and South America, backed by a small validated region catalog.
- Pricing: USD, public on-demand/list rates only.
- Architecture view: a simple read-only node/card diagram.

Country-level and direct provider-region selection are later additions after service availability is validated.

## Input modes

Quick Mode requires application type `web-api`, monthly active users, primary geography, traffic (low, medium, high, or spiky), availability (standard, production, high, or mission-critical), and priority (cost, balanced, reliability, or low-operations).

Advanced Mode sends the same canonical model and may override request volume, requests per user, peak RPS, response size, database size/profile, object storage, egress, budget, managed-service preference, and vendor-lock-in tolerance.

Performance is not an MVP ranking priority because no defensible cross-provider methodology exists yet.

## Reference scenario

```text
Application: Web API / SaaS
Monthly active users: 100,000
Primary geography: Europe
Traffic: Medium
Availability: Production
Priority: Balanced
```

This scenario is the first end-to-end demo and must return all three provider candidates, architecture and service mappings, selected region, cost total and breakdown, score, recommendation, trade-offs, assumptions, confidence, missing information, constraint results, and pricing timestamp.

## Definition of done

A new user can:

1. Enter the required Quick Mode fields in under one minute.
2. Provide users, geography, traffic, availability, and priority.
3. Receive an AWS architecture.
4. Receive an Azure architecture.
5. Receive a GCP architecture.
6. See estimated monthly public list-price cost for each candidate.
7. Inspect a component-level cost breakdown.
8. See which constraints each candidate satisfies.
9. See a deterministic ranking.
10. Understand why the first candidate ranked above alternatives.
11. Inspect assumptions made by Cloud Arena.
12. See confidence and missing information.
13. Override important assumptions in Advanced Mode.
14. Retrieve the same authoritative information through the API.
15. See when pricing data was retrieved.

The engine must be validated against official calculators using frozen golden scenarios, with discrepancies and known limitations documented.

## Explicit non-goals

The MVP excludes authentication, accounts, payments, subscriptions, LLM/AI architecture generation, MCP, Terraform generation or deployment, Kubernetes, GPU and AI workloads, Kafka, data lakes, multi-region active-active, disaster recovery simulation, performance benchmarking/scoring, private pricing and discounts, Savings Plans/CUD/Reserved/Spot optimization, taxes, FX conversion, historical billing, FinOps optimization, and mobile apps.

## Next architecture and roadmap

After the baseline works, add a `managed-container-postgres` pattern using appropriate managed offerings such as ECS/Fargate, Azure Container Apps, and Cloud Run. Then prioritize more regions, sensitivity analysis, growth/budget/break-even scenarios, more databases, cache, queues, NoSQL, commitment pricing, performance methodology, multi-region, providers, Terraform, MCP, CLI, and agent integrations.
