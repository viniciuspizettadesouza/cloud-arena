import {
  budgetConstraintResultSchema,
  workloadInputSchema,
  type BudgetConstraintResult,
  type WorkloadInput,
} from "@cloud-arena/contracts";

export function evaluateMonthlyBudget(
  uncheckedInput: WorkloadInput,
  actualMonthlyCostUSD?: number,
): BudgetConstraintResult {
  const input = workloadInputSchema.parse(uncheckedInput);
  const budgetUSD = input.monthlyBudgetUSD;

  if (budgetUSD === undefined) {
    return budgetConstraintResultSchema.parse({
      constraint: "monthly-budget",
      status: "not-applicable",
      satisfied: null,
      violations: [],
    });
  }

  if (actualMonthlyCostUSD === undefined) {
    return budgetConstraintResultSchema.parse({
      constraint: "monthly-budget",
      status: "pending",
      satisfied: null,
      budgetUSD,
      violations: [],
    });
  }

  if (!Number.isFinite(actualMonthlyCostUSD) || actualMonthlyCostUSD < 0) {
    throw new RangeError("actualMonthlyCostUSD must be a finite, non-negative number.");
  }

  if (actualMonthlyCostUSD <= budgetUSD) {
    return budgetConstraintResultSchema.parse({
      constraint: "monthly-budget",
      status: "satisfied",
      satisfied: true,
      budgetUSD,
      actualMonthlyCostUSD,
      violations: [],
    });
  }

  return budgetConstraintResultSchema.parse({
    constraint: "monthly-budget",
    status: "violated",
    satisfied: false,
    budgetUSD,
    actualMonthlyCostUSD,
    violations: [
      {
        constraint: "monthlyBudgetUSD",
        expected: `at most USD ${budgetUSD}`,
        actual: actualMonthlyCostUSD,
      },
    ],
  });
}
