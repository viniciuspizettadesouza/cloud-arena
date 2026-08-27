import { expect, test } from "@playwright/test";

import { comparisonFixture } from "./comparison-fixture";

const referenceInput = {
  applicationType: "web-api",
  monthlyActiveUsers: 100_000,
  geography: { type: "continent", value: "Europe" },
  trafficProfile: "medium",
  availability: "production",
  priority: "balanced",
};

test("submits the reference workload and inspects comparison evidence", async ({ page }) => {
  await page.route("**/api/compare", async (route) => {
    expect(route.request().postDataJSON()).toEqual(referenceInput);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(comparisonFixture),
    });
  });
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Find your cloud. See the evidence." }),
  ).toBeVisible();
  await page.getByText("Advanced Mode").click();
  await expect(page.getByLabel("Monthly budget (USD)")).toBeVisible();
  await page.getByRole("button", { name: "Compare AWS, Azure & GCP" }).click();
  await expect(
    page.getByRole("heading", { name: "Three clouds, one inspectable decision" }),
  ).toBeVisible();
  await expect(page.locator(".provider-card")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "AWS", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Microsoft Azure" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Google Cloud" })).toBeVisible();
  await page.locator(".provider-aws").getByText("Inspect costs, scores & architecture").click();
  await expect(page.locator(".provider-aws").getByText("Pricing gaps")).toBeVisible();
  await expect(page.getByRole("heading", { name: /confidence/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Assumptions & provenance" })).toBeVisible();
  await expect(page.getByText("AWS pricing: missing")).toBeVisible();
});

test("shows canonical client validation errors", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Monthly active users").fill("0");
  await page.getByRole("button", { name: "Compare AWS, Azure & GCP" }).click();
  await expect(page.locator("#monthlyActiveUsers-error")).toContainText(">0");
});
