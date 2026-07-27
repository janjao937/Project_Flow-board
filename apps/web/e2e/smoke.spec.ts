import { test, expect } from "@playwright/test";

test("home shows Flowboard brand", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByText("Flowboard").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "New workflow" })).toBeVisible();
});

test("can create a workspace from home", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("button", { name: "New workflow" }).click();
  await expect(page).toHaveURL(/\/en\/workspace/);
  await expect(page.getByRole("button", { name: "Sticky" })).toBeVisible();
});
