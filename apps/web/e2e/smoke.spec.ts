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

test("workspace exposes roadmap and plan pages", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("button", { name: "New workflow" }).click();
  await expect(page).toHaveURL(/\/en\/workspace/);
  await page.getByRole("button", { name: "Roadmap" }).click();
  await expect(page.getByRole("heading", { name: "Roadmap" })).toBeVisible();
  await page.getByRole("button", { name: "Plan" }).click();
  await expect(page.getByRole("heading", { name: "Plan" })).toBeVisible();
});

test("board phase 3 tools are available", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("button", { name: "New workflow" }).click();
  await expect(page.getByRole("button", { name: "Frame" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Draw" })).toBeVisible();
  await expect(page.getByRole("button", { name: "PNG" })).toBeVisible();
});
