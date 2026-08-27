import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { GcpCatalogAdapter, gcpCredentialError } from "../src/index.js";

describe("GCP Catalog adapter blocking paths", () => {
  it("returns an actionable missing-credential error", async () => {
    const adapter = new GcpCatalogAdapter(undefined);
    await expect(
      adapter.fetch({ regions: ["europe-west1"], categories: ["compute"] }),
    ).rejects.toMatchObject({
      category: "configuration",
      message: expect.stringMatching(/GCP_API_KEY.*SPIKE-A1-GCP/),
    });
  });

  it("classifies the frozen anonymous API response as authentication failure", () => {
    const fixture = JSON.parse(
      readFileSync(
        new URL("./fixtures/catalog-api-credential-error.json", import.meta.url),
        "utf8",
      ),
    ) as { response: { body: Parameters<typeof gcpCredentialError>[0] } };
    expect(gcpCredentialError(fixture.response.body)).toMatchObject({
      category: "authentication",
      message: expect.stringMatching(/Enable the Cloud Billing API/),
    });
  });
});
