import { test, expect } from "@playwright/test";

test.describe("Event Loop Visualizer", () => {
  test("should load the page and run basic timers example", async ({
    page,
  }) => {
    // Navigate to the app
    await page.goto("/");

    // Check title
    await expect(page.getByText("Node.js Event Loop Visualizer")).toBeVisible();

    // Select the "Basic Timers" example
    const select = page.getByRole("combobox");
    await select.selectOption("basic-timers");

    // Click Run Code
    await page.getByRole("button", { name: "▶ Run Code" }).click();

    // Now speed it up to 2x for faster test
    await page.getByRole("button", { name: "2x" }).click();

    // Click play
    await page.getByRole("button", { name: "▶ Play" }).click();

    // Wait until it finishes (status becomes "✓ Finished")
    // Use a longer timeout just in case
    await expect(page.getByText("✓ Finished")).toBeVisible({ timeout: 10000 });

    // Verify console output
    const consolePanel = page
      .locator("text=🖥 Console Output")
      .locator("..")
      .locator("..");

    // We expect basic timers to output 'timeout 1', 'timeout 2', 'immediate'
    await expect(consolePanel).toContainText("timeout 1");
    await expect(consolePanel).toContainText("timeout 2");
    await expect(consolePanel).toContainText("immediate");
  });
});
