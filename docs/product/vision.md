# Product Vision

## The decision Cloud Arena supports

Cloud Arena answers:

> Given the system I want to build, its workload, users, geography, reliability requirements, budget, and preferences, what cloud architecture should I use, on which provider, how much should it cost, and why?

```text
business requirements
  -> normalized technical workload
  -> provider-neutral architecture patterns
  -> AWS, Azure, and GCP candidates
  -> estimated costs and constraint evaluation
  -> deterministic scoring and ranking
  -> recommendation, alternatives, assumptions, and confidence
```

Cloud Arena starts with “What do I need?” rather than requiring the user to have already selected infrastructure.

## Audience

The primary user is designing a new application without an existing cloud estate. They may know business scale and reliability needs but not cloud SKUs. Advanced users and future machine consumers can supply technical overrides and consume the structured API.

No existing cloud account, billing history, telemetry, CMDB, Terraform, Kubernetes, or architecture is required.

## Market position

CloudZero, Finout, Cloudability, CloudHealth, Harness, and related FinOps tools primarily optimize existing infrastructure and bills. Infracost estimates architecture already expressed as infrastructure as code. Holori compares services and pricing. Pinpole explores AI-generated architecture and simulation. IBM Txture is the closest benchmark, but is primarily oriented toward an existing estate and brownfield migration.

Cloud Arena remains explicitly **greenfield-first**: it derives comparable target architectures from workload requirements.

## Product principles

### Provider-neutral domain

The core expresses capabilities such as `compute.vm` and `database.postgresql.managed`. Provider mappings and API behavior live behind adapters. Mappings mean functionally comparable, never identical.

### Deterministic before AI

Given the same workload, pricing snapshot, catalog version, assumptions version, and scoring version, the engine returns the same result. An LLM is not part of the MVP recommendation path.

### Explainability over false precision

Important values identify whether they came from the user, a derivation, a default heuristic, provider data, or a Cloud Arena rule. Prices include line items and exclusions. Heuristic scores are labeled as such.

### Constraints differ from preferences

A budget is a hard condition with an explicit violation. A preference changes scoring weights. A constraint failure cannot disappear inside a reduced score.

### No hidden winner

The result presents all candidates, their scores, cost and fit, why the first ranked first, why alternatives lost, and which assumptions affected the outcome.

## Strategic evolution

After validating the baseline, Cloud Arena adds managed-container and serverless patterns, regions, sensitivity analysis, growth and break-even scenarios, more data services, commitment pricing, a defensible performance methodology, multi-region designs, additional providers, Terraform, CLI, MCP, and AI integrations.

Sensitivity analysis is the most important post-MVP capability: it should explain the conditions under which each candidate becomes preferable, not merely identify today’s winner.

