# Launch Regions and Baseline Service Configurations

Status: SPIKE-B1 complete  
Updated: 2026-08-25

This decision freezes the initial geography-to-region catalog and baseline deployable configurations. It separates service/deployability evidence from pricing evidence. Billing price identifiers are adapter data, not semantic service IDs; GCP billing SKU IDs remain deferred to SPIKE-A1-GCP.

## Geography-to-region catalog

| Geography | AWS | Azure | GCP | Selection rationale |
| --- | --- | --- | --- | --- |
| Europe | `eu-west-1` — Ireland | `westeurope` — Netherlands | `europe-west1` — Belgium | Established regions with the complete baseline service set and explicit managed PostgreSQL support. |
| North America | `us-east-1` — N. Virginia | `eastus` — Virginia | `us-east4` — N. Virginia | Same broad eastern-US user geography; no measured-latency claim. |
| South America | `sa-east-1` — São Paulo | `brazilsouth` — São Paulo state | `southamerica-east1` — São Paulo | Same metropolitan geography and explicit managed PostgreSQL support. |

These are deterministic product defaults, not assertions that a region is geographically closest or lowest latency. Country/provider-region input remains post-MVP. Region availability is versioned and revalidated during catalog releases.

## Baseline configurations

| Capability | AWS | Azure | GCP |
| --- | --- | --- | --- |
| `compute.vm` | EC2 `m6i.large`, Linux, shared tenancy, on-demand, EBS-only; 2 vCPU / 8 GiB | Azure VM `Standard_D2as_v5`, Linux, pay-as-you-go, no local disk; 2 vCPU / 8 GiB | Compute Engine `e2-standard-2`, Linux, on-demand; 2 vCPU / 8 GiB |
| `database.postgresql.managed` | RDS for PostgreSQL `db.m6g.large`, General Purpose SSD `gp3`; Single-AZ or Multi-AZ deployment selected by availability rule | Azure Database for PostgreSQL Flexible Server, General Purpose `Standard_D2ds_v5`, provisioned storage; same-zone or zone-redundant HA selected by availability rule | Cloud SQL for PostgreSQL Enterprise edition, custom `db-custom-2-8192`, SSD storage; zonal or regional HA selected by availability rule |
| `storage.object` | S3 Standard, regional bucket | StorageV2/General Purpose v2 Blob Storage, Hot access tier, Standard LRS | Cloud Storage Standard, regional location matching the compute region |
| `network.load-balancer` | Application Load Balancer, internet-facing, HTTP/HTTPS | Application Gateway `Standard_v2`, public frontend, HTTP/HTTPS | Global external Application Load Balancer, Premium Tier, HTTP/HTTPS, instance-group backend |
| `network.cdn` | Not included in baseline | Not included in baseline | Not included in baseline |

Machine choices intentionally use roughly comparable 2-vCPU/8-GiB general-purpose configurations. They are starting points for the fixed MVP pattern, not performance equivalence claims. Architecture rules may increase instance count or database availability mode; they do not silently switch machine families.

## Availability-mode rules

| Workload availability | Compute | PostgreSQL | Candidate disclosure |
| --- | --- | --- | --- |
| `standard` | One VM | Single-zone deployment | No zone-failure tolerance; lower-cost baseline. |
| `production` | Two VMs distributed across available zones/fault domains | Provider HA deployment (AWS Multi-AZ DB instance, Azure zone-redundant HA where supported, GCP regional HA) | Reference-scenario mode. |
| `high` | Two VMs minimum and provider HA database | Same as production | Baseline pattern may fit but receives caveats because capacity/autoscaling and recovery objectives are unspecified. |
| `mission-critical` | Baseline candidate still generated for comparison | Provider HA database | Mark material reliability-fit limitation: single-region VM pattern cannot establish mission-critical suitability or regional disaster recovery. |

If a selected region temporarily cannot create the required HA form, the candidate remains visible with an unavailable/unsupported component state; it does not downgrade silently.

## Evidence by provider

### AWS

- AWS region documentation identifies `eu-west-1`, `us-east-1`, and `sa-east-1` as Ireland, N. Virginia, and São Paulo.
- AWS's M6i regional announcement explicitly includes N. Virginia, Ireland, and São Paulo, and identifies on-demand purchase availability.
- AWS's RDS M6g/R6g regional announcement explicitly includes N. Virginia, Ireland, and São Paulo for RDS PostgreSQL and lists compatible PostgreSQL versions.
- The São Paulo region launch lists EC2, S3, RDS, and Elastic Load Balancing as regional services. Current service availability must still be checked at catalog-release time.

### Azure

- Azure's region list identifies `westeurope`, `eastus`, and `brazilsouth` and their physical geographies.
- The Dasv5 VM size documentation defines `Standard_D2as_v5` as 2 vCPU/8 GiB and records its feature/storage characteristics.
- Azure Database for PostgreSQL Flexible Server's maintained region table lists West Europe, East US, and Brazil South with Intel v5 compute and HA capabilities; the selected database SKU uses the documented Ddsv5 family.
- Application Gateway v2 documentation lists only China East, China North, US DOD East, and US DOD Central as unsupported for Standard_v2/WAF_v2, so all three selected commercial regions are in scope.
- Azure Compute Resource SKU availability is subscription-aware. Before a region/SKU record becomes selectable, catalog validation must query `Microsoft.Compute/skus` for the target subscription/region and reject restrictions. This runtime validation protects against capacity/subscription differences that a static document cannot guarantee.

### GCP

- Google Cloud's location catalog states that all regions provide Compute Engine, Cloud Storage, Cloud SQL, and VPC at minimum.
- Compute Engine's regions/zones table lists the E2 machine series in zones of `europe-west1`, `us-east4`, and `southamerica-east1`.
- Cloud SQL PostgreSQL's maintained region table explicitly lists all three selected regions and supports Enterprise edition there.
- The global external Application Load Balancer supports Compute Engine backends; it is global rather than deployed as a regional service instance. The candidate still records the backend's primary region.

## Catalog validation requirements

1. Store service configuration IDs separately from provider billing SKU IDs.
2. Treat the table above as an allowlist; an unlisted family/region cannot be selected merely because a price exists.
3. Revalidate service availability before each catalog release and record source retrieval dates.
4. For Azure, enforce Resource SKU restrictions before publishing selectable VM records.
5. For AWS, verify current instance-type offerings/orderable DB options during catalog release when authenticated APIs are available.
6. For GCP, verify billing SKU/region alignment under SPIKE-A1-GCP before the pricing adapter is enabled.
7. A failed availability check yields an explicit unsupported/unavailable component, never an alternate SKU chosen without review.

## Official references

- [AWS regions](https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions.html)
- [AWS EC2 M6i regional availability](https://aws.amazon.com/about-aws/whats-new/2021/12/amazon-ec2-m6i-instances-regions/)
- [AWS RDS M6g/R6g regional availability](https://aws.amazon.com/about-aws/whats-new/2023/08/amazon-rds-m6g-r6g-database-instances-six-regions/)
- [Azure region list](https://learn.microsoft.com/en-us/azure/reliability/regions-list)
- [Azure Dasv5 sizes](https://learn.microsoft.com/en-us/azure/virtual-machines/sizes/general-purpose/dasv5-series)
- [Azure Database for PostgreSQL Flexible Server regions](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/service-overview)
- [Azure Compute Resource SKUs API](https://learn.microsoft.com/en-us/rest/api/compute/resource-skus/list)
- [Google Cloud locations](https://cloud.google.com/about/locations)
- [Compute Engine regions and machine-series availability](https://cloud.google.com/compute/docs/regions-zones)
- [Cloud SQL for PostgreSQL region availability](https://cloud.google.com/sql/docs/postgres/region-availability-overview)
