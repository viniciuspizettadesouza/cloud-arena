import { expect, test } from "@playwright/test";

test("renders the Cloud Arena web shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Compare clouds with evidence" })).toBeVisible();
  await expect(page.getByText("Foundation ready")).toBeVisible();
});
