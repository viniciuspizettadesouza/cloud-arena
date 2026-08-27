import type { CloudProvider } from "@cloud-arena/domain";
import {
  PricingSyncError,
  type PricingAdapter,
  type PricingAdapterResult,
  type PricingSyncRequest,
} from "@cloud-arena/pricing";

export const GCP_PROVIDER: CloudProvider = "gcp";
export const GCP_ADAPTER_VERSION = "gcp-cloud-billing-v1-blocked";

interface GcpErrorPayload {
  error?: { code?: number; message?: string; status?: string };
}

export function gcpCredentialError(payload: GcpErrorPayload): PricingSyncError {
  const code = payload.error?.code;
  const detail = payload.error?.message ?? "Cloud Billing Catalog rejected the caller identity.";
  return new PricingSyncError(
    code === 401 || code === 403 ? "authentication" : "configuration",
    `GCP Cloud Billing Catalog credentials are not usable. Enable the Cloud Billing API and set GCP_API_KEY or configure an accepted caller identity. ${detail}`,
    { code, status: payload.error?.status },
  );
}

export class GcpCatalogAdapter implements PricingAdapter {
  readonly provider = "gcp" as const;
  readonly version = GCP_ADAPTER_VERSION;
  readonly #apiKey: string | undefined;

  constructor(apiKey: string | undefined = process.env.GCP_API_KEY) {
    this.#apiKey = apiKey;
  }

  async fetch(request: PricingSyncRequest): Promise<PricingAdapterResult> {
    void request;
    if (this.#apiKey === undefined || this.#apiKey.trim() === "")
      throw new PricingSyncError(
        "configuration",
        "GCP pricing sync requires GCP_API_KEY and an enabled Cloud Billing API. SPIKE-A1-GCP must capture authenticated SKU fixtures before this adapter can normalize or activate GCP pricing.",
      );
    throw new PricingSyncError(
      "configuration",
      "GCP_API_KEY is configured, but exact Cloud Billing service/SKU selectors remain blocked by SPIKE-A1-GCP. Capture and review authenticated fixtures before enabling GCP snapshot activation.",
    );
  }
}
