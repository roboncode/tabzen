import { test, expect } from '@playwright/test';

test.describe('Chat app styles', () => {
  test('renders with correct dark theme and styled layout', async ({ page }) => {
    await page.goto('/');
    const root = page.locator('#root');
    await expect(root).not.toBeEmpty();

    // 1. Body has dark background (#1b1b1f => rgb(27, 27, 31))
    const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bodyBg).toBe('rgb(27, 27, 31)');

    // 2. Main container uses flexbox layout
    const container = page.locator('#root > div');
    const display = await container.evaluate((el) => getComputedStyle(el).display);
    expect(display).toBe('flex');

    // 3. Sidebar has bg-sidebar background (darker than main area)
    const sidebar = page.locator('[class*="bg-sidebar"]').first();
    await expect(sidebar).toBeVisible();
    const sidebarBg = await sidebar.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(sidebarBg).toBe('rgb(22, 22, 24)');

    // 4. Search input has bg-muted/40 background with rounded corners and padding
    const searchInput = page.locator('[class*="bg-muted/40"]').first();
    await expect(searchInput).toBeVisible();
    const searchStyles = await searchInput.evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, borderRadius: s.borderRadius, padding: s.padding };
    });
    expect(searchStyles.bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(parseFloat(searchStyles.borderRadius)).toBeGreaterThan(0);
    expect(searchStyles.padding).not.toBe('0px');

    // 5. Header has bg-muted/30 background shading
    const header = page.locator('[class*="bg-muted/30"]').first();
    await expect(header).toBeVisible();
    const headerBg = await header.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(headerBg).not.toBe('rgba(0, 0, 0, 0)');

    // 6. Chat input area has rounded-3xl container with bg-muted/40 and padding
    const promptContainer = page.locator('[class*="rounded-3xl"]').first();
    await expect(promptContainer).toBeVisible();
    const promptStyles = await promptContainer.evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, borderRadius: s.borderRadius, padding: s.padding };
    });
    expect(promptStyles.bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(parseFloat(promptStyles.borderRadius)).toBeGreaterThanOrEqual(20);
    expect(promptStyles.padding).not.toBe('0px');

    // 7. Suggestion chips are pill-shaped (rounded-full) with background and padding
    const chips = page.locator('[class*="rounded-full"]');
    const chipCount = await chips.count();
    expect(chipCount).toBeGreaterThanOrEqual(3);
    const chipStyles = await chips.first().evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, borderRadius: s.borderRadius, padding: s.padding };
    });
    expect(chipStyles.bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(parseFloat(chipStyles.borderRadius)).toBeGreaterThan(100);
    expect(chipStyles.padding).not.toBe('0px');

    // 8. Textarea placeholder is visible
    const textarea = page.locator('[placeholder="Ask about your saved content..."]');
    await expect(textarea).toBeVisible();

    // 9. "Chats" sidebar label visible
    const chatsLabel = page.locator('text=Chats').first();
    await expect(chatsLabel).toBeVisible();

    // Take final screenshot for visual verification
    await page.screenshot({ path: 'e2e/screenshot-styled.png', fullPage: true });
  });
});
