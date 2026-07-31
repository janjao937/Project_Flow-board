import { test, expect } from "@playwright/test";

async function createHostSession(page: import("@playwright/test").Page) {
  await page.goto("/en");
  await page.getByRole("main").getByRole("button", { name: "New workflow" }).click();
  await expect(page).toHaveURL(/\/en\/workspace/);

  await page.getByRole("button", { name: "Start session" }).click();
  await page.getByRole("button", { name: "Start session" }).last().click();
  await expect(page.getByText("Live session started")).toBeVisible();
  await expect(page.getByText("Join code")).toBeVisible();
}

test.describe("leave session confirm", () => {
  test("cancel keeps the live host session", async ({ page }) => {
    await createHostSession(page);

    await page.getByRole("banner").getByRole("button", { name: "New workflow" }).click();
    const dialog = page.getByTestId("leave-session-confirm");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Start a new workflow?")).toBeVisible();

    await page.getByTestId("leave-session-confirm-cancel").click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Join code")).toBeVisible();
    await expect(page).toHaveURL(/\/en\/workspace/);
  });

  test("confirm on New ends the host session then creates a workflow", async ({ page }) => {
    await createHostSession(page);

    await page.getByRole("banner").getByRole("button", { name: "New workflow" }).click();
    await expect(page.getByTestId("leave-session-confirm")).toBeVisible();
    await page.getByTestId("leave-session-confirm-ok").click();

    await expect(page.getByTestId("leave-session-confirm")).toBeHidden({ timeout: 15_000 });
    await expect(page.getByText("Join code")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Start session" })).toBeVisible();
  });

  test("confirm on Join ends session then navigates to join page", async ({ page }) => {
    await createHostSession(page);

    await page.getByRole("banner").getByRole("button", { name: "Join" }).click();
    const dialog = page.getByTestId("leave-session-confirm");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Leave session to join another?")).toBeVisible();

    await page.getByTestId("leave-session-confirm-ok").click();
    await expect(page).toHaveURL(/\/en\/join/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /Join a session/ })).toBeVisible();
  });
});
