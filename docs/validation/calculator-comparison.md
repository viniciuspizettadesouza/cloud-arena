# Official-calculator comparison report

Status: blocked on 2026-08-27. Report version `calculator-comparison-v1`; policy
`cost-deviation-v1`.

The three workloads and pinned engine dataset are reproducible, but none of the
nine official-calculator comparisons is valid yet. No calculator share/export
evidence was supplied or captured, and the repository has no authenticated GCP
Catalog prices. Under the approved policy, missing evidence or unavailable
pricing must be reported as `invalid-comparison`; it cannot be treated as zero,
a pass, or an exception.

| Scenario | AWS | Azure | GCP |
| --- | --- | --- | --- |
| 10k Europe / medium | Invalid | Invalid | Invalid |
| 100k Europe / spiky / 100 GB DB | Invalid | Invalid | Invalid |
| 500k North America / high availability / USD 2,500 budget | Invalid | Invalid | Invalid |

The machine-readable matrix is
[`fixtures/calculator-comparison-v1.json`](fixtures/calculator-comparison-v1.json).
Each provider cell must be rerun with a calculator export captured within 24
hours of a production-shaped Cloud Arena snapshot. GCP also requires completion
of `SPIKE-A1-GCP` and `M3-004`. Only then can component and modeled-total deltas
be calculated and `M7-002`/`M7-003` closed.

No discrepancy exception is proposed. An absent comparison is not a justified
exception.
