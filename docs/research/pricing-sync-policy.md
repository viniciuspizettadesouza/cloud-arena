# Pricing Synchronization Failure and Freshness Policy

Status: SPIKE-A3 complete  
Updated: 2026-08-25

This policy defines pagination, retries, atomic activation, concurrency, and freshness for public pricing snapshots. It applies to AWS and Azure immediately and to GCP when SPIKE-A1-GCP supplies authenticated fixtures. No failure path permits fabricated pricing.

## Provider retrieval behavior

| Provider | Retrieval and pagination | Authentication behavior |
| --- | --- | --- |
| AWS | Read the public service index, resolve a concrete version and regional offer-file URL, then stream the CSV/JSON file. The public regional bulk file itself is one large download rather than application-level pages. Never parse the mutable `current` alias into an active snapshot without retaining the resolved version/publication date. | Public file URLs used by Cloud Arena require no credentials. If the authenticated Bulk API is adopted later, its list operation uses `NextToken`. |
| Azure | Follow the response `NextPageLink` until null. The API returns at most 1,000 records per response. Preserve the original filter and validate that every next link remains HTTPS on `prices.azure.com`. | Retail Prices API is unauthenticated. |
| GCP | Request a bounded `pageSize`, then pass each `nextPageToken` as `pageToken` until absent. Preserve pricing effective times and every tier in each returned SKU. | Missing/invalid caller identity is a terminal configuration error, not a retryable empty result. |

## Synchronization state machine

```text
created -> fetching -> validating -> ready -> active
              |            |          |
              +----------> failed <----+
```

- `created`: immutable snapshot ID, provider, requested regions/categories, start time, adapter version, and request parameters are stored.
- `fetching`: raw pages/files and checksums are written only under the staging snapshot.
- `validating`: parsing, normalization, deduplication, tier validation, USD/on-demand filtering, and required-coverage checks run against staging data.
- `ready`: all required validations succeeded and record counts/checksums are fixed.
- `active`: one database transaction marks the ready snapshot active and supersedes the previous active snapshot for that provider.
- `failed`: the error class, provider response/status, completed page/file count, retry count, and known gaps are recorded. Failed snapshots are never queryable by comparisons.

Activation is per provider. A comparison uses the current active snapshot for each provider and reports every provider timestamp/version. If the public API contract retains one summary timestamp, it is the oldest retrieval timestamp in the snapshot set, never a claim that all providers synchronized simultaneously.

## Atomicity and concurrency

1. Acquire a provider-scoped advisory/database lock before a sync starts. A second sync for the same provider exits with an already-running result; different providers may sync concurrently.
2. Write raw and normalized records under a new immutable snapshot ID. Never update active records in place.
3. Validate expected regions, categories, selected SKUs, units, currencies, tier ordering, source-price uniqueness, and raw-payload references.
4. Activate with a single database transaction and conditional check that the staging snapshot is still `ready`.
5. On process death, timeout, parser error, missing page, coverage gap, or database failure, mark/reap the staging snapshot as failed and keep the previous active snapshot unchanged.
6. A successful empty response cannot activate for a required selector. Zero-priced records are valid records; zero record count is not.

## Pagination and download safety

- Store page number/token or resolved AWS file version before processing the next unit of work.
- Detect repeated page tokens/links and fail instead of looping.
- Reject provider-directed next links whose scheme or host changes unexpectedly.
- Deduplicate only by the documented source-price identity, not by SKU alone.
- For AWS files, stream to a temporary/staging object, verify successful completion and parse to EOF, then record a checksum. A truncated file fails even if some required rows were seen.
- Set bounded connect, response-header, idle/read, and total-operation timeouts. Large AWS downloads use an intentionally larger total timeout than JSON pages.
- Log counts by raw records, accepted records, rejected pricing models/currencies, duplicates, unknown units, and required coverage gaps.

## Retry policy

Retry only transient failures:

- connection reset, DNS/transient network failure, and timeout;
- HTTP `408`, `425`, `429`, and `5xx`;
- HTTP `409` only when the provider operation is documented/idempotent and the response indicates a transient conflict.

Do not retry malformed requests, unsupported filters, parser/schema violations, checksum mismatches, coverage failures, or other `4xx` responses. In particular, GCP `401/403` is an actionable credential/configuration failure.

Use at most five attempts per page/file request. Honor a valid `Retry-After` header; otherwise use capped exponential backoff with full jitter, starting at 1 second and capped at 30 seconds. The entire provider sync also has a deadline so pagination cannot retry forever. Every request is a read and safe to repeat, but database writes remain idempotent under the staging snapshot/source-price key.

No provider-specific rate limit is hardcoded without official evidence. Concurrency defaults to one request per provider sync; adapters may introduce a separately configured limit after measurement. A `429` always reduces request rate and follows the retry policy.

## Freshness policy

- Schedule a sync at least once every 24 hours. AWS price-change notifications may trigger an additional sync later, but polling remains the MVP mechanism.
- `fresh`: active snapshot retrieval completed no more than 48 hours ago.
- `aging`: older than 48 hours and no more than 72 hours. Results may be returned, but carry a prominent stale-soon warning and reduced pricing confidence.
- `stale`: older than 72 hours. The affected provider cost estimate is `unavailable`; the architecture candidate remains visible.
- Freshness uses successful `retrievedAt`, while provider publication/effective times are shown separately. An old publication date is not stale when a fresh retrieval confirms that it remains the current catalog version.
- A failed scheduled sync never refreshes `retrievedAt` and never extends the previous snapshot's freshness.

The 24/48/72-hour values are initial Cloud Arena operational policy, not provider guarantees. They must be configuration values with a policy version and can be revised from production evidence.

## Error categories

| Category | Examples | Result |
| --- | --- | --- |
| `configuration` | GCP key absent, unsupported region configuration | Fail immediately; actionable operator message. |
| `authentication` | `401`, `403` | Fail immediately; never translate to no prices. |
| `transient-provider` | `429`, `5xx`, timeout | Retry within policy; then fail staging snapshot. |
| `source-schema` | Missing required field, unknown response shape | Fail staging snapshot and retain raw evidence. |
| `normalization` | Unknown unit, invalid decimal/tier, non-USD required record | Fail required coverage; do not substitute. |
| `coverage` | Required component/region has zero matching records | Fail activation for that provider. |
| `persistence` | Transaction/checksum/raw-record failure | Roll back activation and keep previous snapshot. |

## Tests required later

- Azure two-page response, null final link, repeated link, foreign-host link, and failure after page one.
- GCP multiple tokens, repeated token, credential failure, and final empty token.
- AWS truncated download, resolved-version change, invalid CSV/JSON row, checksum mismatch, and EOF success.
- `429` with/without `Retry-After`, retry exhaustion, non-retryable `4xx`, and timeout.
- missing category/region, zero-priced tier, duplicate source-price ID, tier gap/overlap, and unknown unit.
- failed activation preserving the previous snapshot and stale snapshot producing `unavailable` rather than a fake total.

## Official references

- [AWS manual bulk price files and version/region indexes](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/using-the-aws-price-list-bulk-api-fetching-price-list-files-manually.html)
- [AWS price update notifications](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/notifications-price-list-api.html)
- [Azure Retail Prices pagination](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices)
- [GCP `services.skus.list` pagination](https://docs.cloud.google.com/billing/docs/reference/rest/v1/services.skus/list)
