# Official-calculator reference architectures

Status: accepted for `SPIKE-E1` on 2026-08-25. This document freezes inputs and
selection instructions; it does not claim that calculator totals captured now
will remain current. `M7-002` performs and timestamps the actual comparisons.

Machine-readable inputs are in
[`fixtures/calculator-reference-architectures.json`](fixtures/calculator-reference-architectures.json).

## Comparison convention

- Currency: USD.
- Purchase model: public pay-as-you-go/on-demand; no account login, contract
  price, reservation, savings plan, commitment, Spot/preemptible price, or free
  trial credit.
- Month: 730 hours for every continuously provisioned resource.
- Pattern: one public Layer 7 load balancer, Linux VMs, managed PostgreSQL, and
  regional standard object storage in the Region selected by
  [launch-regions-services.md](launch-regions-services.md).
- One HTTP routing rule and one managed TLS certificate. No WAF or CDN.
- Public egress destination is the same geography as the deployment and uses
  [public-egress.md](public-egress.md).
- Decimal workload storage/traffic is converted to a provider's billed GiB when
  required: `GiB = decimal GB * 1,000,000,000 / 1,073,741,824`.
- Calculator estimate names use `<scenario-id>-<provider>` and component names
  use the stable line-item IDs below.

## Frozen workloads

These are validation fixtures, not sizing claims or final normalization
heuristics.

| Scenario | Quick fields | Advanced fields | Derived architecture |
| --- | --- | --- | --- |
| `ref-10k-eu-medium` | 10,000 MAU; Europe; medium traffic; standard availability; balanced priority | 6,000,000 requests/month; 50 KB response; 300 GB public egress; 20 GB DB; 100 GB object storage | One VM and one zonal/single-instance database |
| `ref-100k-eu-spiky` | 100,000 MAU; Europe; spiky traffic; production availability; balanced priority | 60,000,000 requests/month; 50 KB response; 3,000 GB public egress; 100 GB DB; 500 GB object storage | Two VMs and provider HA database |
| `ref-500k-na-ha-budget` | 500,000 MAU; North America; high traffic; high availability; cost priority | 600,000,000 requests/month; 50 KB response; 30,000 GB public egress; 500 GB DB; 2,000 GB object storage; $2,500/month budget | Two VMs and provider HA database |

The calculator-only request-body assumption is 1 KB and is included only for
load-balancer processed-volume inputs; it is not added to the canonical workload
contract.
Monthly LB processed bytes are request bytes plus response/public-egress bytes:
306, 3,060, and 30,600 decimal GB respectively. Backend health checks are
ignored because the calculators do not expose a comparable common input.

## Provider calculator selections

### AWS Pricing Calculator

Use [AWS Pricing Calculator](https://calculator.aws/) and create one group per
scenario.

| Stable line item | Selection |
| --- | --- |
| `compute` | Amazon EC2; Region `eu-west-1` or `us-east-1`; Linux; shared tenancy; `m6i.large`; 100% monthly utilization; 730 hours; quantity 1 or 2 from the scenario; On-Demand; no detailed monitoring |
| `database-compute` | Amazon RDS for PostgreSQL; `db.m6g.large`; 730 hours; Single-AZ for standard or Multi-AZ DB instance deployment for production/high; On-Demand |
| `database-storage` | General Purpose SSD `gp3`; scenario DB capacity; default/zero additional provisioned IOPS and throughput; backup storage 0 |
| `object-storage` | Amazon S3 Standard; scenario stored capacity; all request, retrieval, lifecycle, replication, and acceleration quantities 0 |
| `load-balancer` | Application Load Balancer; one ALB for 730 hours; EC2/IP targets; processed-byte LCU average equal to total LB GB / 730; one rule; new/active connection inputs 0 where the calculator permits direct LCU entry |
| `public-egress` | Internet Data Transfer Out for the full scenario quantity from the deployment Region; same-geography destination; retain the calculator's displayed free-tier handling rather than manually editing its total |

The processed-byte LCU averages are 0.419178, 4.191781, and 41.917808. If the
calculator insists on all four ALB dimensions, use one request per connection,
connection duration 0.2 seconds, and one evaluated rule; retain the maximum
dimension the calculator reports.

### Azure Pricing Calculator

Use [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/)
without signing in or selecting an agreement.

| Stable line item | Selection |
| --- | --- |
| `compute` | Linux Virtual Machines; Region West Europe or East US; `Standard_D2as_v5`; pay as you go; 730 hours; quantity 1 or 2; Azure Hybrid Benefit off |
| `database-compute` | Azure Database for PostgreSQL Flexible Server; General Purpose; `Standard_D2ds_v5`; 730 hours; no HA for standard or zone-redundant HA for production/high |
| `database-storage` | Provisioned storage equal to scenario DB capacity; backup retention/storage at the calculator minimum and recorded as an excluded delta if it cannot be zero; no extra IOPS |
| `object-storage` | Storage Accounts/Block Blob Storage; General Purpose v2; Hot; Standard LRS; scenario capacity; operations, retrieval, replication, and SFTP 0 |
| `load-balancer` | Application Gateway `Standard_v2`; one gateway for 730 hours; capacity-unit-hours fixed at 730, 1,460, and 14,600 for the three scenarios (1, 2, and 20 average capacity units) |
| `public-egress` | Bandwidth; Microsoft Premium Global Network; full scenario quantity from the deployment continent; retain the calculator's displayed 100 GB allowance |

Capacity units are frozen validation inputs, not an autoscaling prediction. The
comparison checks whether Cloud Arena prices those same units; later performance
sizing may replace them only by versioning this fixture.

### Google Cloud Pricing Calculator

Use [Google Cloud Pricing Calculator](https://cloud.google.com/products/calculator)
without linking a billing account.

| Stable line item | Selection |
| --- | --- |
| `compute` | Compute Engine; Region `europe-west1` or `us-east4`; `e2-standard-2`; Linux/free OS; 730 hours; quantity 1 or 2; regular provisioning; no commitment or sustained-use adjustment manually added |
| `database-compute` | Cloud SQL for PostgreSQL; Enterprise edition; `db-custom-2-8192`; 730 hours; single-zone for standard or regional HA for production/high |
| `database-storage` | SSD data storage equal to the scenario capacity converted to GiB; backup and network quantities 0 |
| `object-storage` | Cloud Storage Standard; regional location matching compute; scenario capacity converted to GiB; operations, retrieval, replication, and early deletion 0 |
| `load-balancer` | Global external Application Load Balancer, Premium Tier; one global forwarding rule for 730 hours; inbound and outbound processed quantities whose sum equals 306, 3,060, or 30,600 decimal GB converted to GiB; no Cloud Armor/CDN/custom-header feature |
| `public-egress` | Premium Tier internet data transfer to the scenario geography; full scenario quantity converted to GiB; retain the calculator's destination-specific free-tier handling |

If the calculator combines forwarding-rule and processed-data charges, preserve
its detail/export and compare the combined value to the sum of Cloud Arena's GCP
load-balancer sub-lines.

## Included comparison surface

Only these six stable line items are compared: compute, database compute,
database storage, object-storage capacity, load balancing, and public internet
egress. A provider calculator may add a mandatory sub-line; retain it in the
export but classify it before comparison.

Excluded from the modeled subtotal:

- VM boot/OS disks and snapshots;
- database backups, provisioned IOPS/throughput, query I/O, and licensing beyond
  PostgreSQL;
- object-storage operations, retrieval, lifecycle, replication, and early
  deletion;
- public IPv4, DNS, NAT, inter-zone/inter-Region traffic, private links, logs,
  monitoring, support, taxes, and credits;
- WAF, CDN, DDoS premium products, certificates with separate fees, and secrets;
- autoscaling above the frozen VM and load-balancer quantities.

An excluded mandatory calculator charge is not deleted or hidden: record its
name, amount, reason, and whether Cloud Arena should add the category later.

## Reproduction evidence required at M7

For each of nine estimates, record the UTC timestamp, calculator URL/version if
shown, currency, every input, per-component amount, total, exclusions, and a
share link plus CSV/PDF/XLSX export where supported. AWS officially supports
share links and CSV/PDF export; Azure supports saved/shared estimates and XLSX
export; GCP supports detailed view, shareable estimates, and CSV download.

Official guides: [AWS calculator and exports](https://docs.aws.amazon.com/pricing-calculator/latest/userguide/getting-started.html),
[Azure calculator workflow](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/pricing-calculator),
and [Google Cloud cost estimation](https://docs.cloud.google.com/billing/docs/how-to/estimate-costs).
