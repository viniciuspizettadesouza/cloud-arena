import { describe, expect, it, vi } from "vitest";

import { AwsPriceListAdapter } from "../src/index.js";

const csv = `"FormatVersion","v1.0"
"Publication Date","2026-08-27T00:00:00Z"
"Version","20260827000000"
"SKU","RateCode","TermType","EffectiveDate","StartingRange","EndingRange","Unit","PricePerUnit","Currency","Product Family","Instance Type","Tenancy","Operating System","Pre Installed S/W","CapacityStatus","operation","Region Code"
"sku","sku.term.rate","OnDemand","2026-08-01","0","Inf","Hrs","0.10","USD","Compute Instance","m6i.large","Shared","Linux","NA","Used","RunInstances","eu-west-1"
`;

describe("AWS bulk price fetcher", () => {
  it("parses a complete streamed regional CSV and retains its resolved version", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(csv, { status: 200 }));
    const result = await new AwsPriceListAdapter({ fetch: request }).fetch({
      regions: ["eu-west-1"],
      categories: ["compute"],
    });
    expect(result.records).toHaveLength(1);
    expect(result.rawPayloads[0]?.source).toMatch(/#version=20260827000000$/);
    expect(result.rawPayloads[0]?.checksum).toHaveLength(64);
  });

  it("fails a truncated quoted CSV", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(`${csv}"unterminated`, { status: 200 }));
    await expect(
      new AwsPriceListAdapter({ fetch: request }).fetch({
        regions: ["eu-west-1"],
        categories: ["compute"],
      }),
    ).rejects.toThrow(/ended inside a quoted field/);
  });
});
