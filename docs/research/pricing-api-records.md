# Pricing API Representative Records

Status: SPIKE-A1 complete — AWS and Azure captured; authenticated GCP capture split into SPIKE-A1-GCP  
Retrieved: 2026-08-24T22:45:37Z

This document records SPIKE-A1 research. The fixtures are sanitized selections from official provider responses; they contain no account identifiers, API keys, or credentials. They prove response shapes and filtering needs, not final launch-region or SKU decisions. Exact services and deployability remain SPIKE-B1/B2 concerns.

## Coverage

| Cost category | AWS (`eu-west-1`) | Azure (`westeurope`) | GCP |
| --- | --- | --- | --- |
| Compute | EC2 `m7i.large` | VM `Standard_D2as_v5` | Blocked |
| PostgreSQL compute | RDS `db.m8g.large`, Single-AZ | Flexible Server `Standard_D2ds_v5` | Blocked |
| PostgreSQL storage | RDS PostgreSQL GP3 | Flexible Server storage | Blocked |
| Object storage | S3 Standard | Blob Storage Hot LRS | Blocked |
| Load balancing | Application Load Balancer hourly + LCU | Application Gateway Standard v2 fixed + capacity | Blocked |
| Public egress | AWS outbound, first paid tier | Internet routing preference, first paid tier | Blocked |

The Azure Application Gateway sample is provisional. SPIKE-B2 must decide whether Application Gateway, Azure Load Balancer, or another component is the comparable baseline before catalog data or formulas are frozen.

## AWS

Source: AWS Price List Bulk API regional CSV files. No credentials are required for the public bulk-file URLs.

Request pattern:

```text
GET https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/{offerCode}/current/eu-west-1/index.csv
```

Offer codes queried:

| Category | Offer code | Selection fields |
| --- | --- | --- |
| Compute | `AmazonEC2` | Linux, shared tenancy, used capacity, no preinstalled software, on-demand `m7i.large` |
| Database compute/storage | `AmazonRDS` | PostgreSQL, Single-AZ, on-demand `db.m8g.large`; GP3 storage |
| Object storage | `AmazonS3` | General Purpose / Standard storage |
| Load balancing | `AWSELB` | Application Load Balancer hours and used LCU-hours |
| Egress | `AWSDataTransfer` | AWS outbound from `eu-west-1` to External |

The regional EC2 file was approximately 298 MiB when retrieved. Future synchronization should stream or query selectively rather than retain every bulk file in application memory. AWS exposes products and price dimensions as separate concepts in JSON, while CSV flattens them into rows; SPIKE-A2 must preserve SKU and rate-code identity.

Fixture: `packages/providers/aws/test/fixtures/representative-prices.json`.

## Azure

Source: Azure Retail Prices API. It is unauthenticated. All requests used `currencyCode=USD`, `armRegionName eq 'westeurope'`, and `priceType eq 'Consumption'`.

Endpoint:

```text
GET https://prices.azure.com/api/retail/prices
```

Representative filters:

```text
serviceName eq 'Virtual Machines' and armSkuName eq 'Standard_D2as_v5'
serviceName eq 'Azure Database for PostgreSQL' and armSkuName eq 'Standard_D2ds_v5'
serviceName eq 'Azure Database for PostgreSQL' and contains(productName, 'Flex Server Storage')
serviceName eq 'Storage' and productName eq 'Blob Storage' and skuName eq 'Hot LRS'
serviceName eq 'Application Gateway'
serviceName eq 'Bandwidth'
```

Findings needed by SPIKE-A2/A3:

- One VM SKU query can return Linux, Windows, Spot, low-priority, and Cloud Services records. Product, meter, price type, and SKU fields must all participate in selection.
- Tiered prices repeat a meter ID with different `tierMinimumUnits`; meter ID alone is not a unique price dimension.
- Broad Storage queries paginate at 1,000 items through `NextPageLink`.
- Some egress meters are not marked as the primary meter region, so `isPrimaryMeterRegion` cannot be treated as a universal inclusion rule without category-specific evidence.

Fixture: `packages/providers/azure/test/fixtures/representative-prices.json`.

## Google Cloud

Source attempted: Cloud Billing Catalog API.

```text
GET https://cloudbilling.googleapis.com/v1/services?pageSize=1
```

The anonymous request returned HTTP 403 `PERMISSION_DENIED`: unregistered callers are not allowed. Official setup requires a Google Cloud project with the Cloud Billing API enabled and an API key or another accepted caller identity. This environment has no Google API key, application-default credentials, or active `gcloud` identity.

After credentials are supplied, run:

```text
GET https://cloudbilling.googleapis.com/v1/services?key=API_KEY
GET https://cloudbilling.googleapis.com/v1/services/SERVICE_ID/skus?currencyCode=USD&key=API_KEY
```

Then retain on-demand records covering Compute Engine VM compute, Cloud SQL for PostgreSQL compute/storage, Cloud Storage, external HTTP(S) load balancing, and public internet egress in a European region. Preserve `skuId`, description, category, service regions/geo taxonomy, pricing effective time, usage units, base-unit conversion, aggregation information, and every tiered rate.

Credential-error fixture: `packages/providers/gcp/test/fixtures/catalog-api-credential-error.json`.

## Deferred authenticated GCP capture

SPIKE-A1-GCP owns the remaining authenticated catalog capture. Once credentials are intentionally configured, add sanitized representative SKU records, retain the credential-error fixture for negative-path tests, and update this document and implementation status. The deferred task remains a dependency of the GCP adapter, so the split does not authorize fabricated GCP prices.

## Official references

- [AWS: getting price list files manually](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/using-the-aws-price-list-bulk-api-fetching-price-list-files-manually.html)
- [AWS: reading service price list files](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/reading-service-price-list-file-for-services.html)
- [Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices)
- [Google Cloud Billing Catalog API setup](https://docs.cloud.google.com/billing/v1/how-tos/catalog-api)
- [Google Cloud `services.skus.list`](https://docs.cloud.google.com/billing/docs/reference/rest/v1/services.skus/list)
