import { test, expect } from "@playwright/test";

test("join page is reachable", async ({ page }) => {
  await page.goto("/en/join");
  await expect(page.getByRole("heading", { name: /Join a session|เข้าร่วมเซสชัน/ })).toBeVisible();
  await expect(page.getByLabel(/Join code|รหัสเข้าร่วม/)).toBeVisible();
});
