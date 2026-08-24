# Original Implementation Brief

> Foundational source supplied by the project owner on 2026-08-24. It is preserved below without substantive edits. Focused documents elsewhere in this repository are the maintainable source of truth; if implementation research conflicts with this brief, official provider documentation is authoritative and the discrepancy must be recorded.

---

Sim. **Eu começaria o MVP agora.** Não vejo mais nenhuma pesquisa de mercado que justifique adiar a implementação.

O que ainda falta são **5 technical spikes**, mas eles devem ser as primeiras tarefas do próprio desenvolvimento, não uma fase anterior de pesquisa: validar os SKUs exatos que usaremos, disponibilidade regional, fórmulas de egress, política de cache/attribution dos dados e comparar algumas estimativas do Arena com os calculators oficiais. As bases estão confirmadas: AWS tem Price List API própria para pricing/scenario planning; Azure tem Retail Prices API pública e sem autenticação; GCP fornece catálogo, SKUs, preços e regiões pela Cloud Billing Catalog API; e FOCUS 1.4 é uma boa referência para normalização financeira. ([AWS Documentation][1])

Abaixo está o **brief completo que eu enviaria ao Codex**. Ele foi escrito propositalmente para não depender desta conversa.

---

# Cloud Arena — MVP Implementation Brief

## 1. Product vision

Build **Cloud Arena**, a greenfield multi-cloud architecture decision engine.

The central question Cloud Arena answers is:

> Given the system I want to build, its expected workload, users, geography, reliability requirements, budget and preferences, what cloud architecture should I use, on which provider, how much should it cost, and why?

Cloud Arena must compare equivalent or functionally comparable architectures across initially:

* AWS
* Microsoft Azure
* Google Cloud Platform

Cloud Arena is **not merely a cloud pricing calculator**.

The intended flow is:

```text
Business / workload requirements
            ↓
Normalize technical workload
            ↓
Generate architecture candidates
            ↓
 AWS        Azure        GCP
  ↓           ↓           ↓
architecture architecture architecture
            ↓
Calculate estimated costs
            ↓
Evaluate constraints
            ↓
Score candidates
            ↓
Rank alternatives
            ↓
Explain recommendation
            ↓
Show assumptions, confidence and missing information
```

The primary differentiator is:

```text
WHAT DO I NEED?
       ↓
WHAT SHOULD I BUILD?
       ↓
WHERE SHOULD I BUILD IT?
       ↓
WHY?
```

rather than:

```text
I already chose infrastructure
       ↓
How much does it cost?
```

---

# 2. Market positioning

Several existing products solve adjacent problems.

CloudZero, Finout, Cloudability, CloudHealth, Harness and similar FinOps products mainly optimize **existing cloud infrastructure and billing**.

Infracost estimates infrastructure cost once IaC has already defined the architecture.

Holori compares services and prices between providers.

Pinpole explores AI-generated architecture and simulation but is very early-stage.

IBM Txture is the most important benchmark. It can generate and compare target cloud architectures across providers, but primarily starts from an **existing application estate / brownfield migration scenario**.

Cloud Arena should therefore remain explicitly:

> **Greenfield-first.**

The user should not need:

* existing cloud accounts;
* billing history;
* telemetry;
* CMDB;
* Terraform;
* Kubernetes;
* existing architecture.

They should be able to start with:

```text
I want to build a SaaS.
100,000 users.
Mostly European users.
PostgreSQL.
High availability.
Budget around $1,000/month.
```

---

# 3. Core product principles

The implementation must preserve these principles from the beginning.

### Provider-neutral domain

The core recommendation engine must never be built around AWS concepts.

Bad:

```ts
if (provider === "aws") {
  ...
}
```

Good:

```text
Capability:
managed-compute

Provider implementations:
AWS → ...
Azure → ...
GCP → ...
```

Provider-specific behavior belongs behind adapters.

### Deterministic before AI

Do **not** put an LLM inside the recommendation engine for the MVP.

The same input must produce the same result when using the same:

```text
pricing dataset
catalog version
assumption version
scoring version
```

AI may consume Cloud Arena later.

Cloud Arena itself must initially be explainable and deterministic.

### Explainability over false precision

Never present uncertain information as fact.

The engine must distinguish:

```text
user-provided
derived
default assumption
provider data
heuristic
```

### Constraints are different from preferences

Example constraint:

```text
budget <= $1000
```

Example preference:

```text
cost is more important than portability
```

A violated constraint must not simply reduce a score.

It must be represented explicitly.

### No hidden winner

Never return only:

```text
AWS wins.
```

Return:

```text
AWS
Score: 89

Estimated cost: $420
Reliability fit: High
Operational complexity: Medium
Portability: Medium

Why it ranked first
Why the second option lost
Which assumptions influenced the decision
```

---

# 4. MVP scope

The first usable MVP should prove one complete vertical slice:

> A user describes a greenfield Web API/SaaS workload and Cloud Arena returns one comparable AWS, Azure and GCP architecture with estimated monthly costs, a ranking, explanations, assumptions and confidence.

Do not attempt to support every cloud service.

## Providers

Support only:

```text
AWS
Azure
GCP
```

Create provider abstractions so additional providers can be added later.

## Initial workload

Support:

```text
Web API / SaaS
PostgreSQL
Object storage
HTTP traffic
Single-primary-region deployment
```

The UI may display future workload types as disabled or simply omit them.

Do not implement Kubernetes, GPU, Kafka, AI workloads, data lakes, multi-region active-active, etc. in the MVP.

---

# 5. Two input modes

Design the domain so Cloud Arena effectively supports two input modes, even if they share one screen initially.

## Quick mode

For humans who do not know infrastructure details.

Required inputs:

```text
Application type
Monthly active users
Primary geography
Traffic profile
Availability requirement
Priority
```

For MVP:

```text
applicationType = web-api
```

Traffic:

```text
low
medium
high
spiky
```

Availability:

```text
standard
production
high
mission-critical
```

Priority:

```text
cost
balanced
reliability
low-operations
```

Do not offer `performance` as a serious ranking dimension until Cloud Arena has a defensible performance methodology.

Performance can appear later.

## Advanced mode

Allow technically knowledgeable users and AI agents to override derived assumptions.

Optional fields:

```text
requestsPerMonth
averageRequestsPerUserPerDay
peakRequestsPerSecond
averageResponseKB

databaseStorageGB
databaseReadWriteProfile

objectStorageGB
monthlyEgressGB

monthlyBudget

managedServicesPreference
vendorLockInTolerance
```

Quick Mode and Advanced Mode MUST feed the same canonical workload model.

---

# 6. Separate raw input from normalized workload

Create two domain objects.

## WorkloadInput

Represents exactly what the user supplied.

Example:

```ts
interface WorkloadInput {
  applicationType: "web-api";

  monthlyActiveUsers: number;

  geography: {
    type: "continent" | "country" | "provider-region";
    value: string;
  };

  trafficProfile:
    | "low"
    | "medium"
    | "high"
    | "spiky";

  availability:
    | "standard"
    | "production"
    | "high"
    | "mission-critical";

  priority:
    | "cost"
    | "balanced"
    | "reliability"
    | "low-operations";

  requestsPerMonth?: number;
  averageRequestsPerUserPerDay?: number;
  peakRequestsPerSecond?: number;
  averageResponseKB?: number;

  databaseStorageGB?: number;
  objectStorageGB?: number;
  monthlyEgressGB?: number;

  monthlyBudgetUSD?: number;

  managedServicesPreference?: "low" | "medium" | "high";
  vendorLockInTolerance?: "low" | "medium" | "high";
}
```

Use Zod as the runtime schema and derive TypeScript types from it wherever practical.

---

# 7. NormalizedWorkload

Create a normalization/assumption engine.

It converts friendly business inputs into technical inputs required by architecture generation and pricing.

Example:

```ts
interface NormalizedWorkload {
  monthlyActiveUsers: number;

  requestsPerMonth: number;
  averageRequestsPerSecond: number;
  peakRequestsPerSecond: number;

  averageResponseKB: number;
  monthlyEgressGB: number;

  databaseStorageGB: number;
  objectStorageGB: number;

  availabilityTarget: number;

  regionPreference: string;

  assumptions: Assumption[];

  missingInformation: MissingInformation[];

  confidence: number;
}
```

---

# 8. Assumptions must be versioned

Do not scatter magic numbers through code.

Create something like:

```text
data/assumptions/workload-v1.yaml
```

Example concepts:

```yaml
web-api:
  traffic:
    low:
      requestsPerUserPerDay: ...
      peakMultiplier: ...

    medium:
      requestsPerUserPerDay: ...

    high:
      requestsPerUserPerDay: ...

    spiky:
      requestsPerUserPerDay: ...
      peakMultiplier: ...
```

The exact initial values are heuristics.

Therefore:

* document them;
* version them;
* expose them to users;
* allow Advanced Mode to override them;
* never describe them as industry facts.

---

# 9. Track provenance

Every important normalized field must have provenance.

Example:

```ts
type ValueSource =
  | "user"
  | "derived"
  | "default";

interface FieldProvenance {
  field: string;
  source: ValueSource;
  description?: string;
}
```

Result example:

```text
monthlyUsers
100000
source: user

requestsPerUserPerDay
20
source: default

requestsPerMonth
60,000,000
source: derived
```

This is particularly important for future AI consumers.

---

# 10. Confidence

Implement a simple **heuristic confidence model**, not probabilistic AI confidence.

Important workload variables should carry weights.

For example:

```text
request volume
egress
database size
geography
availability
storage
```

User-provided:

```text
confidence contribution = 1.0
```

Derived:

```text
~0.6
```

Default assumption:

```text
~0.3
```

Compute a weighted total.

Expose:

```text
confidence: 0.68
```

and a human-friendly representation:

```text
Medium confidence
```

Also return the biggest sources of uncertainty.

Example:

```text
Missing information that would improve this estimate:

1. Monthly network egress — high impact
2. Peak RPS — high impact
3. Database size — medium impact
```

---

# 11. Architecture capability model

Create provider-neutral capabilities.

Initial capability taxonomy:

```text
compute.vm

database.postgresql.managed

storage.object

network.load-balancer

network.cdn
```

Later:

```text
compute.managed-container
compute.serverless
cache.redis
queue
nosql
kubernetes
```

Do not model every provider service from day one.

---

# 12. First architecture pattern

Start with the easiest defensible cross-cloud baseline:

## VM + managed PostgreSQL

AWS:

```text
EC2
RDS PostgreSQL
S3
Load Balancer
CloudFront when applicable
```

Azure:

```text
Azure Virtual Machines
Azure Database for PostgreSQL
Blob Storage
Azure Load Balancer/Application Gateway as appropriate
Front Door/CDN when applicable
```

GCP:

```text
Compute Engine
Cloud SQL PostgreSQL
Cloud Storage
Cloud Load Balancing
Cloud CDN when applicable
```

The exact networking components should be validated during implementation.

Do not pretend services are perfectly equivalent.

Store relationships as:

```text
equivalent capability
```

rather than:

```text
identical product
```

---

# 13. Second architecture pattern

Only after the first vertical slice works, introduce:

```text
managed-container-postgres
```

Candidates can then include concepts such as:

```text
AWS → ECS Fargate / appropriate managed container option
Azure → Container Apps
GCP → Cloud Run
```

At this point Cloud Arena starts selecting not just:

```text
which provider?
```

but:

```text
which provider + architecture pattern?
```

That is strategically important but should not block milestone 1.

---

# 14. Service catalog

Create a manually curated, versioned catalog.

Suggested structure:

```text
data/catalog/

capabilities/
providers/
regions/
architecture-patterns/
```

Example:

```yaml
id: database.postgresql.managed

providers:
  aws:
    service: Amazon RDS for PostgreSQL

  azure:
    service: Azure Database for PostgreSQL

  gcp:
    service: Cloud SQL for PostgreSQL
```

Provider adapters may enrich this catalog with pricing/API information.

Do not make external provider APIs responsible for defining semantic equivalence.

That equivalence is part of Cloud Arena's domain knowledge.

---

# 15. Pricing architecture

Create a normalized pricing boundary.

```ts
interface PricingProvider {
  provider: CloudProvider;

  fetchPrices(
    query: PricingQuery
  ): Promise<PricingRecord[]>;
}
```

Implement:

```text
AwsPricingProvider
AzurePricingProvider
GcpPricingProvider
```

AWS should use the AWS Price List APIs. AWS explicitly documents their use for pricing lookup, scenario planning and cost-benefit analysis. ([AWS Documentation][1])

Azure should use the Azure Retail Prices API. It provides retail rates by service/SKU/region and does not require authentication. ([Microsoft Learn][2])

GCP should use the Cloud Billing Catalog API, which exposes services, SKUs, pricing metadata and SKU regions. It requires a configured API key. ([Google Cloud Documentation][3])

---

# 16. Do not query providers during every comparison

Use:

```text
Provider APIs
      ↓
pricing sync
      ↓
normalized pricing storage
      ↓
recommendation requests
```

Create initially:

```bash
pnpm pricing:sync
```

Allow:

```bash
pnpm pricing:sync --provider aws
pnpm pricing:sync --provider azure
pnpm pricing:sync --provider gcp
```

Background scheduling can come later.

The comparison endpoint should query locally stored pricing.

---

# 17. Pricing record

Use a FOCUS-inspired naming model where appropriate, without claiming full FOCUS compliance.

FOCUS 1.4 already standardizes concepts for costs, services, regions, resource usage and provider billing across technology providers. ([FOCUS][4])

Example:

```ts
interface PricingRecord {
  provider: "aws" | "azure" | "gcp";

  serviceCategory: string;
  serviceName: string;

  skuId: string;
  skuName?: string;

  region: string;

  pricingModel:
    | "on-demand"
    | "reserved"
    | "spot"
    | "commitment";

  unit: string;
  unitPrice: number;

  currency: "USD";

  effectiveAt?: string;
  retrievedAt: string;

  source: string;
}
```

For the MVP use:

```text
USD
on-demand/public list pricing
```

only.

Explicitly postpone:

```text
enterprise discounts
private contracts
Savings Plans
CUDs
reserved pricing optimization
spot
taxes
FX conversion
```

The schema should allow them later.

---

# 18. Cost engine

The cost engine must operate on normalized architecture components.

Example:

```text
Compute
Database compute
Database storage
Object storage
Network egress
Load balancing
```

Return:

```ts
interface CostEstimate {
  monthlyCostUSD: number;

  lineItems: CostLineItem[];

  includedItems: string[];
  excludedItems: string[];

  pricingSnapshotAt: string;

  confidence: number;
}
```

Never return just one total.

UI:

```text
Estimated monthly cost

Compute             $72
Database            $115
DB storage           $18
Object storage        $4
Network egress       $63
Load balancing       $21
────────────────────────
Total               $293
```

And explicitly show things not modeled.

Example:

```text
Not included:
support plans
taxes
backup beyond baseline
custom discounts
monitoring beyond baseline
```

---

# 19. Region model

Region must be first-class.

Define:

```ts
interface CloudRegion {
  provider: CloudProvider;

  id: string;
  name: string;

  country?: string;
  continent: string;

  latitude?: number;
  longitude?: number;
}
```

Do not claim real latency based solely on geographic distance.

For MVP, support a curated small set of launch geographies.

Recommended initial geography profiles:

```text
Europe
North America
South America
```

Optionally add country-level routing for:

```text
Portugal
Spain
Germany
France
United Kingdom
United States
Canada
Brazil
```

only after validating service availability.

Advanced users should eventually be able to override provider regions directly.

---

# 20. Constraints engine

Create explicit:

```ts
interface ConstraintResult {
  satisfied: boolean;
  violations: ConstraintViolation[];
}
```

Initial hard constraint:

```text
monthlyBudgetUSD
```

Example:

```json
{
  "satisfied": false,
  "violations": [
    {
      "constraint": "monthlyBudget",
      "expected": "<= 500",
      "actual": 623
    }
  ]
}
```

Never hide a violation inside the score.

---

# 21. Scoring model

Scoring must be deterministic and versioned.

Initial dimensions:

```text
cost
reliabilityFit
operationalSimplicity
portability
```

Do **not** claim objective cross-provider performance measurements yet.

`performance` should become a scoring dimension only after a separate methodology exists.

Example balanced weights:

```text
cost                  35%
reliabilityFit        30%
operationalSimplicity 20%
portability           15%
```

Cost profile:

```text
cost                  65%
reliabilityFit        15%
operationalSimplicity 15%
portability            5%
```

Reliability profile:

```text
reliabilityFit        55%
cost                  20%
operationalSimplicity 15%
portability           10%
```

Low-operations:

```text
operationalSimplicity 50%
cost                  25%
reliabilityFit        20%
portability            5%
```

Put the actual values in:

```text
data/scoring/v1.yaml
```

Do not bury them in code.

---

# 22. Separate objective and heuristic metrics

Every score should expose its nature.

Example:

```text
Cost
source: provider pricing
confidence: high

Reliability fit
source: architecture rules
confidence: medium

Operational simplicity
source: Cloud Arena heuristic
confidence: medium

Portability
source: Cloud Arena heuristic
confidence: medium
```

This prevents Cloud Arena from presenting subjective judgments as measured facts.

---

# 23. Recommendation result

Canonical API response should resemble:

```ts
interface ComparisonResult {
  input: WorkloadInput;

  normalizedWorkload: NormalizedWorkload;

  candidates: ArchitectureCandidate[];

  recommendation: {
    candidateId: string;
    score: number;

    reasons: string[];

    caveats: string[];
  };

  assumptions: Assumption[];

  missingInformation: MissingInformation[];

  confidence: number;

  metadata: {
    pricingSnapshotAt: string;
    catalogVersion: string;
    assumptionsVersion: string;
    scoringVersion: string;
  };
}
```

This JSON is important.

The web UI is only one consumer.

Future consumers include:

```text
CLI
AI agents
MCP
IDE extensions
other applications
```

---

# 24. API-first

Build a real API rather than hiding the domain inside frontend server actions.

Initial endpoints:

```text
GET  /health

GET  /v1/providers
GET  /v1/regions
GET  /v1/capabilities

POST /v1/workloads/normalize

POST /v1/compare
```

Optional development/admin:

```text
POST /internal/pricing/sync
```

Prefer running pricing sync through CLI rather than public HTTP initially.

Generate OpenAPI documentation.

---

# 25. Frontend UX

The home page should communicate immediately:

> Compare cloud architectures for the system you want to build.

Primary form:

```text
What are you building?
Web API / SaaS

Monthly users
100,000

Users are mainly in
Europe

Traffic
Medium

Availability
Production

Priority
Balanced

[ Compare clouds ]
```

Below or behind:

```text
Advanced settings
```

---

# 26. Comparison screen

Top section:

```text
Recommended

AWS
$293/month
Score 87/100
Confidence: Medium
```

Then three provider cards:

```text
AWS
Azure
Google Cloud
```

Each showing:

```text
estimated monthly cost
score
selected region
architecture pattern
main services
constraint status
```

Then a side-by-side table.

Then:

```text
Why this recommendation?
```

Example:

```text
AWS ranked first because:

+ lowest estimated cost
+ satisfies availability target
+ cost remains within budget

Trade-offs:

- Azure has lower operational complexity
- portability score is similar
```

Then:

```text
Assumptions
```

and:

```text
How to improve this estimate
```

---

# 27. Architecture visualization

Do not build a sophisticated drag-and-drop architecture editor in the MVP.

A simple read-only representation is enough:

```text
Internet
   ↓
Load Balancer
   ↓
VM / Compute
   ↓
PostgreSQL

Object Storage
```

Use simple cards/nodes.

A full architecture canvas is later scope.

---

# 28. Recommended technical stack

Use a TypeScript monorepo.

```text
pnpm
Turborepo
TypeScript
```

Frontend:

```text
Next.js
React
Tailwind CSS
shadcn/ui
```

Backend:

```text
Fastify
Zod
OpenAPI
Pino
```

Database:

```text
PostgreSQL
Drizzle ORM
```

Development:

```text
Docker Compose
```

Testing:

```text
Vitest
Playwright
```

CI:

```text
GitHub Actions
```

Use latest stable package versions available when implementing rather than hardcoding versions from this document.

---

# 29. Repository structure

Start with:

```text
cloud-arena/

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
  architecture/
  product/
  research/
  adr/

scripts/

docker-compose.yml
README.md
```

If an existing repository already contains useful structure, preserve it rather than blindly recreating everything.

---

# 30. Dependency direction

Keep domain logic independent.

Desired dependency flow:

```text
domain
  ↑
contracts

catalog
pricing
scoring
recommendation
  ↑
providers

api
  ↑
web
```

The domain package must not import:

```text
React
Fastify
Drizzle
AWS SDK
Azure SDK
Google SDK
```

---

# 31. Database

Initial tables may include:

```text
pricing_snapshots
pricing_records
cloud_services
cloud_regions
```

Do not persist comparisons/users yet unless technically useful.

Most semantic catalog information can remain version-controlled YAML during the MVP.

This provides better auditability than putting everything in DB.

---

# 32. Technical spikes — do these first

These are implementation tasks, not reasons to delay coding.

## Spike A — pricing APIs

For the initial services, fetch representative records from:

```text
AWS Price List API
Azure Retail Prices API
GCP Cloud Billing Catalog API
```

Save sanitized fixtures under:

```text
packages/providers/*/test/fixtures/
```

Document the fields required for normalization.

## Spike B — service availability

Verify initial service/SKU availability for launch regions.

Azure's Compute Resource SKU API, for example, exposes locations, availability zones, capabilities and restrictions for SKUs. ([Microsoft Learn][5])

GCP SKU catalog data includes the regions in which SKUs are available. ([Google Cloud Documentation][3])

Do not assume that a listed price automatically means the exact architecture is deployable everywhere.

## Spike C — network egress

Document how initial providers charge public internet egress.

Implement only the tiers necessary for the initial scenarios.

Do not attempt every networking pricing permutation.

## Spike D — data usage policy

Document provider pricing-data terms relevant to:

```text
caching
storage
redistribution
attribution
```

Before public launch, make sure the implementation complies.

## Spike E — calculator validation

Create three reference architectures manually using official provider calculators and compare them against Cloud Arena's cost engine.

Record discrepancies.

Set an acceptable initial deviation threshold for the modeled components.

---

# 33. Tests

Testing is critical because pricing normalization can silently produce plausible but wrong numbers.

Use several levels.

## Unit tests

Test:

```text
workload normalization
assumption selection
constraint evaluation
scoring
cost formulas
region selection
confidence calculation
```

## Provider parser tests

Use frozen API fixtures.

Do not make normal unit tests depend on live cloud APIs.

## Golden scenario tests

Create fixed workloads with frozen pricing snapshots.

Example:

```text
Scenario A
10k users
Europe
medium traffic

Scenario B
100k users
Europe
spiky traffic
100 GB DB

Scenario C
500k users
North America
high availability
budget constraint
```

Golden tests should verify deterministic calculations.

Do not hardcode an assumption that AWS, Azure or GCP must always win.

## API integration tests

Test `/v1/compare`.

## E2E

Playwright:

```text
open app
fill Quick Mode
compare
receive three candidates
open cost breakdown
see assumptions
see confidence
```

---

# 34. Quality gates

Every PR/commit milestone should leave:

```text
format passing
lint passing
typecheck passing
unit tests passing
build passing
```

CI should enforce these.

Do not suppress TypeScript or ESLint errors merely to make CI green.

---

# 35. Documentation

Create immediately:

```text
README.md

docs/product/vision.md
docs/product/mvp.md

docs/architecture/overview.md
docs/architecture/domain-model.md

docs/research/competitors.md
docs/research/pricing-sources.md

docs/scoring.md
docs/assumptions.md
```

Also create ADRs.

Initial ADRs:

```text
ADR-001 Provider-neutral domain model

ADR-002 API-first architecture

ADR-003 Deterministic recommendation engine

ADR-004 Pricing snapshot strategy

ADR-005 YAML semantic catalog

ADR-006 USD public on-demand pricing for MVP
```

---

# 36. Explicit non-goals

Do not implement yet:

```text
authentication
user accounts
payments
subscriptions

AI architecture generation
LLM dependency

MCP server

Terraform generation
deployment

Kubernetes

multi-region active-active
disaster recovery simulation

performance benchmarking

private enterprise pricing
discount negotiation
Savings Plans optimization
CUD optimization

historical cloud billing

FinOps optimization

mobile application
```

These are intentionally postponed.

---

# 37. Milestones

## Milestone 0 — foundation

Deliver:

```text
monorepo
web
api
shared domain
CI
Docker PostgreSQL
basic docs
```

Acceptance:

```text
pnpm install
pnpm dev
pnpm test
pnpm build
```

all work.

---

## Milestone 1 — domain engine

Implement:

```text
WorkloadInput
NormalizedWorkload
assumptions
provenance
confidence
constraints
```

No cloud APIs required yet.

Acceptance:

given a Quick Mode input, return a normalized technical workload with assumptions.

---

## Milestone 2 — cloud semantic catalog

Implement:

```text
AWS
Azure
GCP

capabilities
regions
service mappings
baseline architecture pattern
```

Acceptance:

given a normalized workload, create one provider-specific baseline architecture per provider.

---

## Milestone 3 — pricing adapters

Implement real:

```text
AWS adapter
Azure adapter
GCP adapter
```

and pricing synchronization.

Acceptance:

local DB contains normalized current public price records for the services needed by the baseline architecture.

---

## Milestone 4 — cost engine

Calculate monthly component costs.

Acceptance:

every candidate returns:

```text
total
breakdown
included items
excluded items
pricing timestamp
```

---

## Milestone 5 — recommendation engine

Implement:

```text
constraints
scoring
ranking
reasons
trade-offs
```

Acceptance:

`POST /v1/compare` produces a complete deterministic comparison.

---

## Milestone 6 — frontend

Build Quick Mode and comparison UI.

Acceptance:

a person can go from requirements to AWS/Azure/GCP comparison without understanding cloud SKUs.

---

## Milestone 7 — validation

Compare golden scenarios against official calculators.

Fix material discrepancies.

Document known limitations.

This milestone defines MVP completion.

---

# 38. MVP Definition of Done

The MVP is complete when a new user can:

1. Describe a Web API/SaaS workload in less than one minute.
2. Provide users, geography, traffic, availability and priority.
3. Receive an AWS architecture.
4. Receive an Azure architecture.
5. Receive a GCP architecture.
6. See estimated monthly public list-price cost for each.
7. See a component-level cost breakdown.
8. See which constraints each candidate satisfies.
9. See a deterministic ranking.
10. Understand why the first candidate ranked above the others.
11. See assumptions made by Cloud Arena.
12. See confidence and missing information.
13. Override important assumptions with Advanced Mode.
14. Retrieve the same information through the API.
15. See when pricing data was retrieved.

---

# 39. Important correctness rules

Never fabricate provider pricing.

Never silently fall back to invented prices if provider data is unavailable.

If pricing is unavailable:

```text
status: unavailable
```

is preferable to a fake estimate.

Never call heuristic ratings objective benchmarks.

Never claim actual latency without measured or authoritative latency data.

Never claim two cloud products are identical.

Use:

```text
functionally comparable
```

or:

```text
implements the same Cloud Arena capability
```

Keep provider raw data available for debugging.

Every displayed price should ultimately be traceable to:

```text
provider
service
SKU
region
unit
price
pricing snapshot
cost formula
```

---

# 40. Build for future AI consumption

Do not implement MCP yet, but ensure the API result is sufficiently structured that an AI agent can reason over it.

An agent should be able to determine:

```text
what won
why it won
what assumptions exist
what constraints failed
what data is missing
how confident Cloud Arena is
what alternatives exist
```

Avoid making the AI parse human prose to obtain core facts.

Structured JSON is authoritative.

Human-readable explanations should be derived from the structured result.

---

# 41. Future roadmap after MVP

Once the MVP is validated, likely order:

```text
managed container architecture pattern

serverless architecture pattern

more regions/countries

sensitivity analysis

growth scenarios

budget optimization

break-even analysis

more databases

cache

queues

NoSQL

commitment pricing

performance methodology

multi-region

additional providers

Terraform generation

MCP server

CLI

AI agent integrations
```

---

# 42. Sensitivity analysis is the most important post-MVP feature

Eventually Cloud Arena should answer:

```text
GCP is cheapest today.

AWS becomes cheaper when traffic exceeds X.

Azure becomes preferable if operational simplicity
is weighted above Y.

This architecture exceeds your budget if egress
passes Z TB/month.
```

That evolves Cloud Arena from:

```text
Who wins?
```

to:

```text
Under which conditions does each alternative win?
```

Preserve enough separation between workload normalization, architecture generation, pricing and scoring so this can be implemented later without rewriting the system.

---

# 43. Codex working instructions

Before changing code:

1. Inspect the repository.
2. Read existing README, package files and configs.
3. Preserve good existing conventions.
4. Create/update documentation describing major architectural decisions.

Work incrementally.

Do not attempt all milestones in one giant change.

Prefer small coherent changes with tests.

After each milestone run:

```bash
format
lint
typecheck
test
build
```

Maintain:

```text
docs/implementation-status.md
```

with:

```text
completed
in progress
next
known limitations
technical decisions
```

If a cloud API behaves differently from this document, treat the official provider API as authoritative, document the discrepancy, and adapt the implementation without violating the product principles above.

Do not introduce large dependencies without a clear reason.

Do not implement future features merely because they are easy.

The goal is to get the first complete, trustworthy comparison working end-to-end.

---

# 44. First implementation target

The first meaningful demo should be:

```text
Input

Application:
Web API / SaaS

Monthly active users:
100,000

Primary geography:
Europe

Traffic:
Medium

Availability:
Production

Priority:
Balanced
```

Cloud Arena derives the missing technical workload and returns:

```text
AWS
architecture
region
services
estimated monthly cost
cost breakdown
score

Azure
architecture
region
services
estimated monthly cost
cost breakdown
score

GCP
architecture
region
services
estimated monthly cost
cost breakdown
score

Recommended candidate

Why

Trade-offs

Assumptions

Confidence

Missing information

Pricing timestamp
```

That is the first real product milestone.

Do not expand scope until this works well.

---

## Minha recomendação para você

Eu entregaria **exatamente esse brief ao Codex e começaria agora**. A única mudança de ordem que faria em relação ao plano original é começar pela arquitetura `VM + managed PostgreSQL`, porque ela nos permite testar com mais clareza o problema mais difícil — **normalização e pricing real entre três providers** — antes de introduzir Fargate/Container Apps/Cloud Run, cujos modelos de cobrança tornam a comparação bem mais complicada.

Depois que essa vertical estiver funcionando, a segunda arquitetura `managed-container-postgres` é quando o Arena realmente começa a demonstrar a visão maior de **escolher arquitetura**, e não somente comparar fornecedores.

Também manteria **performance fora do score do MVP**. Custo pode ser sustentado por pricing oficial; reliability fit, operations e portability podem ser claramente marcados como heurísticas. Performance exigirá benchmark/simulation methodology para não transformar um produto que pretende ser confiável em um ranking baseado em números inventados.

[1]: https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/Welcome.html?utm_source=chatgpt.com "Welcome - AWS Billing and Cost Management"
[2]: https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices?utm_source=chatgpt.com "Azure Retail Prices REST API overview | Microsoft Learn"
[3]: https://docs.cloud.google.com/billing/v1/how-tos/catalog-api?utm_source=chatgpt.com "Get publicly available Google Cloud pricing information  |  Cloud Billing  |  Google Cloud Documentation"
[4]: https://focus.finops.org/focus-specification/ "FOCUS Specification 1.4"
[5]: https://learn.microsoft.com/en-us/rest/api/compute/resource-skus/list?view=rest-compute-2025-11-01&utm_source=chatgpt.com "Resource Skus - List - REST API (Azure Compute) | Microsoft Learn"

