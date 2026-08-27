import { workloadInputSchema, type WorkloadInput } from "@cloud-arena/contracts";

const OPTIONAL_NUMBERS = [
  "requestsPerMonth",
  "averageRequestsPerUserPerDay",
  "peakRequestsPerSecond",
  "averageResponseKB",
  "databaseStorageGB",
  "objectStorageGB",
  "monthlyEgressGB",
  "monthlyBudgetUSD",
] as const;

export type FormErrors = Record<string, string>;

export function workloadFromForm(
  form: FormData,
): { success: true; data: WorkloadInput } | { success: false; errors: FormErrors } {
  const candidate: Record<string, unknown> = {
    applicationType: form.get("applicationType"),
    monthlyActiveUsers: Number(form.get("monthlyActiveUsers")),
    geography: { type: "continent", value: form.get("geography") },
    trafficProfile: form.get("trafficProfile"),
    availability: form.get("availability"),
    priority: form.get("priority"),
  };
  for (const field of OPTIONAL_NUMBERS) {
    const value = form.get(field);
    if (typeof value === "string" && value.trim() !== "") candidate[field] = Number(value);
  }
  for (const field of [
    "databaseReadWriteProfile",
    "managedServicesPreference",
    "vendorLockInTolerance",
  ]) {
    const value = form.get(field);
    if (typeof value === "string" && value.trim() !== "") candidate[field] = value;
  }
  const parsed = workloadInputSchema.safeParse(candidate);
  if (parsed.success) return { success: true, data: parsed.data };
  const errors: FormErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path.at(-1);
    if (field !== undefined && errors[String(field)] === undefined)
      errors[String(field)] = issue.message;
  }
  return { success: false, errors };
}
