import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_WORKLOAD_ASSUMPTIONS_PATH,
  loadWorkloadAssumptions,
  parseWorkloadAssumptions,
} from "../src/index.js";

describe("workload assumption configuration", () => {
  it("loads the complete versioned configuration", () => {
    const configuration = loadWorkloadAssumptions();

    expect(configuration.version).toBe("workload-v1");
    expect(Object.keys(configuration.trafficProfiles)).toEqual(["low", "medium", "high", "spiky"]);
    expect(configuration.trafficProfiles.medium).toEqual({
      requestsPerUserPerDay: 20,
      peakMultiplier: 3,
    });
    expect(configuration.confidence.sourceContributions).toEqual({
      user: 1,
      derived: 0.6,
      default: 0.3,
    });
  });

  it("fails fast when required configuration is missing", () => {
    expect(() => parseWorkloadAssumptions("version: workload-v1")).toThrow();
  });

  it("fails fast when confidence weights do not sum to one", () => {
    const invalidSource = readFileSync(DEFAULT_WORKLOAD_ASSUMPTIONS_PATH, "utf8").replace(
      "weight: 0.2",
      "weight: 0.25",
    );

    expect(() => parseWorkloadAssumptions(invalidSource)).toThrow(/weights must sum to 1/i);
  });
});
