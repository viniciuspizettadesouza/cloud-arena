# Pricing-data usage and publication policy

Status: research complete on 2026-08-25. This is an engineering risk review,
not legal advice. It identifies a public-launch blocker that must be cleared by
qualified counsel or written provider permission before Cloud Arena exposes
provider-derived prices publicly.

## Decision

Cloud Arena may continue development and private testing with provider price
catalogs. Until the blocker below is cleared, it must not publish raw catalog
records, bulk downloads, or an API that acts as a substitute price feed.

The product may be designed to show narrowly selected, derived workload
estimates with source links, retrieval times, and disclaimers, but public release
of even that derived presentation requires the `M7-004` compliance review.

## Source review

| Provider | Intended use documented by provider | Restriction/risk found | MVP consequence |
| --- | --- | --- | --- |
| AWS | AWS documents the Price List API for scenario-planning tools, forecasts, and cost-benefit comparisons. It also says API files are informational and the service pricing page controls on conflict. | AWS Site Terms limit commercial exploitation, copying, derivative use, and data extraction absent a separate license/agreement. The exact license applicable to public Price List payload redistribution is not stated in the API documentation reviewed. | Internal catalog use and calculation match the documented purpose. Do not redistribute source files or offer a raw-price API. Obtain legal confirmation for public derived estimates. |
| Azure | Microsoft describes the unauthenticated Retail Prices API as a way to build internal analysis and price-comparison tools. | Microsoft API Terms allow copies only as necessary for the application's intended scenario, prohibit requesting excess data, and prohibit redistribution/resale/sublicensing of API data. Microsoft Learn's general terms also restrict commercial copying absent permission. | Fetch only fields/records needed by the supported catalog. Store them internally; never expose source records or a general-purpose Azure price feed. Public derived estimates remain subject to legal confirmation. |
| GCP | Google documents the Cloud Billing Catalog API as programmatic access to the public catalog of billable SKUs, public pricing, Regions, and metadata. | Google Cloud Terms prohibit selling, reselling, sublicensing, transferring, or distributing the Services and retain Google's IP rights. The reviewed Catalog documentation does not provide a specific redistribution license for payloads. | Internal use is allowed only under the configured account's agreement. Do not expose raw payloads or API credentials. Obtain legal confirmation for public derived estimates after `SPIKE-A1-GCP` captures the applicable API evidence. |

Primary sources:

- AWS [Price List overview](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/price-changes.html),
  [Site Terms](https://aws.amazon.com/terms/), and
  [Service Terms](https://aws.amazon.com/service-terms/).
- Microsoft [Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices),
  [Microsoft APIs Terms of Use](https://learn.microsoft.com/en-us/legal/microsoft-apis/terms-of-use),
  and [Microsoft Learn Terms of Use](https://learn.microsoft.com/en-us/legal/termsofuse).
- Google [Cloud Billing Catalog API guide](https://docs.cloud.google.com/billing/v1/how-tos/catalog-api),
  [Google Cloud Terms](https://cloud.google.com/terms), and
  [Service Specific Terms](https://cloud.google.com/terms/service-terms).

Terms are mutable. `M7-004` must re-check the current versions and record the
effective dates and reviewer.

## Approved engineering controls

### Collection and caching

- Use only documented endpoints and obey quotas, pagination, retry guidance, and
  credentials. Do not scrape calculator pages.
- Limit persisted records to selected launch Regions, services, SKUs, price
  dimensions, and traceability fields needed by the MVP. A transient full-file
  download may be required for AWS selection but must not become a public asset.
- Keep provider payloads in a private database/object store with application
  access controls. Never commit credentials, signed URLs, or unsanitized
  account-specific data.
- Cache and activate snapshots according to
  [pricing-sync-policy.md](pricing-sync-policy.md); never fabricate a value when
  a provider source is unavailable.

### Retention

- Retain the active raw snapshot and replaced raw snapshots for at most 90 days
  for parser debugging and audit. Delete older raw payloads automatically.
- Retain normalized price facts and calculation trace records for 13 months so a
  user can reproduce a prior estimate, but store only the selected source fields
  needed for that purpose.
- Sanitized test fixtures may be retained with the source code only when they
  contain a minimal representative subset and no credentials, account data, or
  bulk catalog.
- A provider-specific contractual requirement or deletion request overrides
  these defaults. The retention periods require confirmation at `M7-004`.

### Redistribution and API behavior

- Public responses may contain only the calculated line item, unit price used,
  provider/service/SKU labels, Region, source timestamp, formula, and official
  source link needed to explain that estimate.
- Do not return raw provider JSON/CSV, full price dimensions, bulk SKU lists, or
  endpoints that let a caller reconstruct a provider catalog.
- Disable indexing/download of internal snapshots and fixtures in production.
- Do not use provider price data for advertising targeting or marketing-data
  enrichment.

### Attribution and notices

Every candidate price view and exported comparison must show:

```text
Estimated from <provider> public list prices retrieved <timestamp>.
Actual charges may differ. Taxes, discounts, commitments, credits, and
unmodeled usage are excluded. Verify with the official <provider> calculator
and pricing page. Cloud Arena is not affiliated with or endorsed by <provider>.
```

Also show a direct link to the relevant official pricing page, the pricing
snapshot identifier, and the estimate's inclusions/exclusions. Use provider
names as nominative text. Do not use logos or other brand assets until their
current trademark guidelines have been reviewed.

## Public-launch blocker and exit criteria

**Blocker `LEGAL-PRICING-001`:** the reviewed materials do not give an explicit,
provider-specific license for a commercial public comparison product to cache
and display derived catalog prices. Microsoft terms additionally contain an
express API-data redistribution restriction.

`M7-004` may close the blocker only when all of the following are recorded:

1. qualified legal review or written provider permission covers the actual
   production data flow for AWS, Azure, and GCP;
2. retention and deletion jobs implement the approved periods;
3. raw-payload and catalog-reconstruction endpoints are absent or access
   controlled;
4. required attribution, disclaimer, source timestamp, and source links are in
   the UI/API/export surfaces;
5. current terms/effective dates and any provider-specific exceptions are saved
   in the release evidence.

If any provider cannot be cleared, its public price must be marked unavailable;
the application must not substitute an invented or manually copied value.
