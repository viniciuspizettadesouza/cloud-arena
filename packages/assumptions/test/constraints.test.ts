import { describe, expect, it } from "vitest";

import { evaluateMonthlyBudget } from "../src/index.js";

const input = {
  applicationType: "web-api",
  monthlyActiveUsers: 100_000,
  geography: { type: "continent", value: "Europe" },
  trafficProfile: "medium",
  availability: "production",
  priority: "balanced",
} as const;

describe("evaluateMonthlyBudget", () => {
  it("reports an absent budget as not applicable", () => {
    expect(evaluateMonthlyBudget(input)).toEqual({
      constraint: "monthly-budget",
      status: "not-applicable",
      satisfied: null,
      violations: [],
    });
  });

  it("reports a configured budget as pending before cost calculation", () => {
    expect(evaluateMonthlyBudget({ ...input, monthlyBudgetUSD: 500 })).toEqual({
      constraint: "monthly-budget",
      status: "pending",
      satisfied: null,
      budgetUSD: 500,
      violations: [],
    });
  });

  it("reports a satisfied budget", () => {
    expect(evaluateMonthlyBudget({ ...input, monthlyBudgetUSD: 500 }, 499.99)).toMatchObject({
      status: "satisfied",
      satisfied: true,
      violations: [],
    });
  });

  it("reports expected and actual values for a violated budget", () => {
    expect(evaluateMonthlyBudget({ ...input, monthlyBudgetUSD: 500 }, 600)).toEqual({
      constraint: "monthly-budget",
      status: "violated",
      satisfied: false,
      budgetUSD: 500,
      actualMonthlyCostUSD: 600,
      violations: [
        {
          constraint: "monthlyBudgetUSD",
          expected: "at most USD 500",
          actual: 600,
        },
      ],
    });
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid actual monthly cost %s",
    (actualMonthlyCostUSD) => {
      expect(() =>
        evaluateMonthlyBudget({ ...input, monthlyBudgetUSD: 500 }, actualMonthlyCostUSD),
      ).toThrow(RangeError);
    },
  );
});
