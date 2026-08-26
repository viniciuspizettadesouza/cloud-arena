import { describe, expect, it } from "vitest";

import { workloadInputSchema } from "../src/index.js";

const quickModeInput = {
  applicationType: "web-api",
  monthlyActiveUsers: 100_000,
  geography: { type: "continent", value: "Europe" },
  trafficProfile: "medium",
  availability: "production",
  priority: "balanced",
} as const;

describe("workloadInputSchema", () => {
  it("accepts the reference Quick Mode workload", () => {
    expect(workloadInputSchema.parse(quickModeInput)).toEqual(quickModeInput);
  });

  it("accepts Advanced Mode overrides in the same canonical model", () => {
    const result = workloadInputSchema.safeParse({
      ...quickModeInput,
      averageRequestsPerUserPerDay: 20,
      averageResponseKB: 50,
      databaseReadWriteProfile: "balanced",
      databaseStorageGB: 100,
      managedServicesPreference: "high",
      monthlyBudgetUSD: 2_500,
      monthlyEgressGB: 3_000,
      objectStorageGB: 500,
      peakRequestsPerSecond: 500,
      requestsPerMonth: 60_000_000,
      vendorLockInTolerance: "medium",
    });

    expect(result.success).toBe(true);
  });

  it.each([
    ["missing required field", { ...quickModeInput, monthlyActiveUsers: undefined }],
    ["zero users", { ...quickModeInput, monthlyActiveUsers: 0 }],
    ["fractional users", { ...quickModeInput, monthlyActiveUsers: 1.5 }],
    ["invalid traffic profile", { ...quickModeInput, trafficProfile: "bursty" }],
    ["negative storage", { ...quickModeInput, objectStorageGB: -1 }],
    ["zero budget", { ...quickModeInput, monthlyBudgetUSD: 0 }],
    [
      "unsupported launch continent",
      { ...quickModeInput, geography: { type: "continent", value: "Asia" } },
    ],
    ["unknown field", { ...quickModeInput, cloud: "aws" }],
  ])("rejects %s", (_name, input) => {
    expect(workloadInputSchema.safeParse(input).success).toBe(false);
  });
});
