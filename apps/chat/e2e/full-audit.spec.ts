import { test, expect } from '@playwright/test';

const WIDE_VIEWPORT = { width: 1280, height: 800 };
const NARROW_VIEWPORT = { width: 600, height: 800 };

test.describe('Full Chat App Audit', () => {

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(WIDE_VIEWPORT);
    await page.goto('/');
    await page.waitForSelector('#root > div');
  });

  // ── Layout Tests ──────────────────────────────────────────────

  test('1. Dark theme applied — body has dark background', async ({ page }) => {
    const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    // Dark background: hsl(50, 2%, 9%) = rgb(23, 23, 22)
    expect(bodyBg).toBe('rgb(23, 23, 22)');
  });

  test('2. Sidebar visible — darker background, Chats text, search input', async ({ page }) => {
    // Sidebar container has bg-sidebar
    const sidebar = page.locator('[class*="bg-sidebar"]').first();
    await expect(sidebar).toBeVisible();

    const sidebarBg = await sidebar.evaluate((el) => getComputedStyle(el).backgroundColor);
    // bg-sidebar = hsl(50, 2%, 7%) = rgb(18, 18, 17)
    expect(sidebarBg).toBe('rgb(18, 18, 17)');

    // "Chats" label (use exact match to avoid matching "New Chat" substring)
    await expect(page.getByText('Chats', { exact: true })).toBeVisible();

    // Search input with styling
    const searchInput = page.locator('input[placeholder="Search chats..."]');
    await expect(searchInput).toBeVisible();
  });

  test('3. Main area — header with New Chat, model switcher visible', async ({ page }) => {
    await expect(page.getByText('New Chat')).toBeVisible();
    await expect(page.getByText('Searching all content')).toBeVisible();
    await expect(page.getByText('GPT-4o Mini')).toBeVisible();
  });

  test('4. Chat input — textarea visible with placeholder and styling', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder="Ask about your saved content..."]');
    await expect(textarea).toBeVisible();

    // The PromptInput wrapper should have rounded-3xl and shaded background
    const promptContainer = page.locator('[class*="rounded-3xl"]').first();
    await expect(promptContainer).toBeVisible();
    const styles = await promptContainer.evaluate((el) => {
      const s = getComputedStyle(el);
      return { borderRadius: s.borderRadius, bg: s.backgroundColor, borderWidth: s.borderWidth };
    });
    // rounded-3xl = 1.5rem = 24px
    expect(parseFloat(styles.borderRadius)).toBeGreaterThanOrEqual(20);
    // Should have shaded background (not transparent)
    expect(styles.bg).not.toBe('rgba(0, 0, 0, 0)');
    // Should NOT have a border (design system: no borders, use shading)
    expect(styles.borderWidth).toBe('0px');
  });

  test('5. Suggestion chips — visible, pill-shaped with background and text', async ({ page }) => {
    const chips = page.locator('[class*="rounded-full"]');
    const chipCount = await chips.count();
    expect(chipCount).toBeGreaterThanOrEqual(3);

    // Verify pill shape
    const firstChipStyles = await chips.first().evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, borderRadius: s.borderRadius, padding: s.padding };
    });
    expect(parseFloat(firstChipStyles.borderRadius)).toBeGreaterThan(100);

    // Verify chip text content is visible (not empty)
    const chipTexts = ['What videos mention React?', 'Summarize recent saves', 'Topics from this week'];
    for (const text of chipTexts) {
      await expect(page.getByText(text)).toBeVisible();
    }
  });

  // ── Responsive Tests ──────────────────────────────────────────

  test('6. Sidebar auto-collapses at narrow viewport', async ({ page }) => {
    await page.setViewportSize(NARROW_VIEWPORT);
    // Wait for matchMedia to fire
    await page.waitForTimeout(500);

    // "Chats" label should not be visible when sidebar collapses
    await expect(page.getByText('Chats', { exact: true })).not.toBeVisible({ timeout: 3000 });

    // Collapsed sidebar strip should be visible with hamburger button
    const collapsedStrip = page.locator('.w-12');
    await expect(collapsedStrip.first()).toBeVisible();
  });

  test('7. Sidebar expands at wide viewport', async ({ page }) => {
    // At wide viewport (set in beforeEach), sidebar should be expanded
    await expect(page.getByText('Chats', { exact: true })).toBeVisible();
    await expect(page.locator('input[placeholder="Search chats..."]')).toBeVisible();
  });

  // ── Interaction Tests ─────────────────────────────────────────

  test('8. Type in chat input — text appears in textarea', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder="Ask about your saved content..."]');
    await textarea.fill('Hello, world!');
    await expect(textarea).toHaveValue('Hello, world!');
  });

  test('9. Click suggestion chip — triggers action (alert expected since no API key)', async ({ page }) => {
    // Set up dialog handler BEFORE clicking
    let dialogMessage = '';
    page.on('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    const chip = page.getByText('What videos mention React?');
    await expect(chip).toBeVisible();
    await chip.click();

    // Wait briefly for alert to fire and be handled
    await page.waitForTimeout(1000);
    expect(dialogMessage).toContain('API key');
  });

  test('10. Toggle sidebar — click hamburger to collapse then expand', async ({ page }) => {
    // Sidebar should be open initially
    await expect(page.getByText('Chats', { exact: true })).toBeVisible();

    // Click the hamburger button in the sidebar to collapse it
    // The first button inside the sidebar is the hamburger
    const sidebarContainer = page.locator('[class*="bg-sidebar"]').first();
    const hamburgerBtn = sidebarContainer.locator('button').first();
    await hamburgerBtn.click();
    await page.waitForTimeout(300);

    // Sidebar text should be hidden
    await expect(page.getByText('Chats', { exact: true })).not.toBeVisible();

    // Collapsed strip should appear
    const collapsedStrip = page.locator('.w-12');
    await expect(collapsedStrip.first()).toBeVisible();

    // Click hamburger in collapsed strip to re-expand
    const expandButton = collapsedStrip.first().locator('button').first();
    await expandButton.click();
    await page.waitForTimeout(300);

    // Sidebar should be visible again
    await expect(page.getByText('Chats', { exact: true })).toBeVisible();
  });

  // ── Component Rendering Tests ─────────────────────────────────

  test('11. ConversationList — search input, Chats header, new chat button', async ({ page }) => {
    // Search input
    await expect(page.locator('input[placeholder="Search chats..."]')).toBeVisible();

    // "Chats" header text
    await expect(page.getByText('Chats', { exact: true })).toBeVisible();

    // New chat button (the + icon button in sidebar header)
    const sidebarContainer = page.locator('[class*="bg-sidebar"]').first();
    const buttons = sidebarContainer.locator('button');
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThanOrEqual(2); // hamburger + new chat
  });

  test('12. PromptInput — textarea renders with proper styling', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder="Ask about your saved content..."]');
    await expect(textarea).toBeVisible();

    // Container has rounded corners and shaded background
    const container = page.locator('[class*="rounded-3xl"]').first();
    await expect(container).toBeVisible();

    const styles = await container.evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, borderRadius: s.borderRadius };
    });
    expect(parseFloat(styles.borderRadius)).toBeGreaterThanOrEqual(20);
    expect(styles.bg).not.toBe('rgba(0, 0, 0, 0)');
  });

  // ── Visual Verification Screenshots ──────────────────────────

  test('13. Screenshot at 1280x800 (desktop)', async ({ page }) => {
    await page.setViewportSize(WIDE_VIEWPORT);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshot-desktop-1280x800.png', fullPage: true });
  });

  test('14. Screenshot at 600x800 (narrow/mobile)', async ({ page }) => {
    await page.setViewportSize(NARROW_VIEWPORT);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshot-narrow-600x800.png', fullPage: true });
  });
});
