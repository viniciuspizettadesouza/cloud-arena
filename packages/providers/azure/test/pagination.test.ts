import { describe, expect, it, vi } from "vitest";

import { AzureRetailPricesAdapter } from "../src/index.js";

describe("Azure pagination", () => {
  it("rejects repeated pagination links", async () => {
    const repeated = "https://prices.azure.com/api/retail/prices?page=2";
    const request = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(JSON.stringify({ Items: [], NextPageLink: repeated }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const adapter = new AzureRetailPricesAdapter({ fetch: request });
    await expect(
      adapter.fetch({ regions: ["westeurope"], categories: ["compute"] }),
    ).rejects.toMatchObject({ category: "source-schema" });
  });

  it("rejects provider-directed links to another host", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ Items: [], NextPageLink: "https://example.com/page" }), {
        status: 200,
      }),
    );
    const adapter = new AzureRetailPricesAdapter({ fetch: request });
    await expect(
      adapter.fetch({ regions: ["westeurope"], categories: ["compute"] }),
    ).rejects.toThrow(/untrusted NextPageLink/);
  });
});
