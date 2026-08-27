import { describe, expect, it, vi } from "vitest";

import { fetchWithRetry } from "../src/index.js";

describe("provider request retries", () => {
  it("retries transient responses and honors Retry-After", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("busy", { status: 429, headers: { "retry-after": "2" } }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const sleep = vi.fn(async () => {});
    await expect(
      fetchWithRetry("https://example.test", {}, { fetch: request, sleep }),
    ).resolves.toMatchObject({
      status: 200,
    });
    expect(sleep).toHaveBeenCalledWith(2_000);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("does not retry authentication failures", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("forbidden", { status: 403 }));
    await expect(
      fetchWithRetry("https://example.test", {}, { fetch: request }),
    ).rejects.toMatchObject({
      category: "authentication",
    });
    expect(request).toHaveBeenCalledOnce();
  });
});
