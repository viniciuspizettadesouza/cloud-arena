import { describe, expect, it } from "vitest";
import { workloadFromForm } from "./form";

function referenceForm() {
  const form = new FormData();
  form.set("applicationType", "web-api");
  form.set("monthlyActiveUsers", "100000");
  form.set("geography", "Europe");
  form.set("trafficProfile", "medium");
  form.set("availability", "production");
  form.set("priority", "balanced");
  return form;
}

describe("workloadFromForm", () => {
  it("produces the canonical reference workload and omits empty overrides", () => {
    const form = referenceForm();
    form.set("monthlyBudgetUSD", "");
    expect(workloadFromForm(form)).toEqual({
      success: true,
      data: {
        applicationType: "web-api",
        monthlyActiveUsers: 100_000,
        geography: { type: "continent", value: "Europe" },
        trafficProfile: "medium",
        availability: "production",
        priority: "balanced",
      },
    });
  });

  it("maps canonical schema issues to form fields", () => {
    const form = referenceForm();
    form.set("monthlyActiveUsers", "0");
    const result = workloadFromForm(form);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.monthlyActiveUsers).toContain(">0");
  });
});
