# Scoring and Constraints

## Dimensions

The deterministic MVP score uses cost, reliability fit, operational simplicity, and portability. Performance is excluded until a defensible measurement methodology exists.

Weights live in `data/scoring/v1.yaml`:

| Priority | Cost | Reliability fit | Operational simplicity | Portability |
| --- | ---: | ---: | ---: | ---: |
| Balanced | 35% | 30% | 20% | 15% |
| Cost | 65% | 15% | 15% | 5% |
| Reliability | 20% | 55% | 15% | 10% |
| Low operations | 25% | 20% | 50% | 5% |

Each dimension returns its raw score, weight, weighted contribution, reasons, source type, and confidence. Scores and weighted contributions retain six decimal places.

The `scoring-v1` rules derive cost from the lowest available traceable candidate estimate. Reliability fit comes from versioned architecture-rule suitability for the requested availability level. Operational simplicity uses component count, HA deployment, and global-component facts. Portability uses the provider-neutral pattern and explicit exclusions. Provider identity is not a scoring input.

## Objective versus heuristic inputs

- Cost is based on normalized provider pricing and has high confidence when all required records are available.
- Reliability fit is based on architecture rules and labeled as such.
- Operational simplicity and portability are Cloud Arena heuristics.
- No score is described as an objective performance benchmark.

## Constraints

Constraints are evaluated separately. The first hard constraint is `monthlyBudgetUSD`, with explicit expected and actual values when violated.

A violation does not disappear inside a score. Candidates remain visible for trade-off inspection, but recommendation logic must explain failures and cannot present a violating candidate as satisfying the requirement.

## Ranking and explanations

Ranking uses the selected priority profile and versioned scoring data. Explanations include why the first candidate ranked first, why the runner-up ranked lower, material trade-offs and caveats, influential assumptions, and the nature/confidence of each metric.

Ranking first requires complete cost data, then applies hard-constraint state, weighted score, available monthly cost, and finally stable candidate ID. A candidate with missing required pricing cannot become the recommendation. A budget violation remains visible and ranks after a candidate that satisfies the constraint. When candidates remain materially tied before the stable-ID tie-break, the response sets `tie: true` and explains the tie behavior.

Tests never encode a permanent provider winner. Frozen scenarios assert deterministic math for a specific catalog, pricing, assumption, and scoring version.
