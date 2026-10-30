// Smoke test: the built site loads and its main paths work in a real browser.
import { test, expect } from '@playwright/test';

// Fail on any page error or console error (a missing chunk, a bad import, ...).
function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
}

test('local mode: add an athlete and a level, pick a skill, export a PDF', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./?local');
  await page.locator('.empty-editor').getByRole('button', { name: 'Add athlete' }).click();
  await page.locator('#f-name').fill('Smoke Test');
  await page.getByRole('button', { name: 'Xcel Gold' }).click();
  await page.getByRole('tab', { name: /Beam/ }).click();
  const skill = page.locator('input.skill-input[data-ev="bb"]').first();
  await skill.fill('back walkover');
  await page.locator('#skill-pop .pop-opt').first().click();
  await expect(skill).toHaveValue(/walkover/i);
  await expect(page.locator('[data-routine="bb"] [data-calc="src"]').first()).toHaveText(/7\.104/);
  // Vaults are searched like skills.
  await page.getByRole('tab', { name: /Vault/ }).click();
  await page.locator('#f-vault').fill('handspring full');
  await page.locator('#skill-pop .pop-opt').first().click();
  await expect(page.locator('#f-vault')).toHaveValue(/1\.201 · Handspring 1\/1 twist/);
  await expect(page.locator('[data-sv="vt"]')).toHaveText('10.0');
  const download = page.waitForEvent('download');
  await page.locator('#export-all').click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
  expect(errors).toEqual([]);
});

test('local mode: copy one event from another level into a level already started', async ({ page }) => {
  const errors = watchErrors(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('./?local');
  await page.locator('.empty-editor').getByRole('button', { name: 'Add athlete' }).click();
  await page.locator('#f-name').fill('Copy Test');
  await page.getByRole('button', { name: 'Xcel Gold' }).click();
  await page.getByRole('tab', { name: /Beam/ }).click();
  await page.locator('input.skill-input[data-ev="bb"]').first().fill('back walkover');
  await page.locator('#skill-pop .pop-opt').first().click();
  // A second level with floor started: beam copies over from Gold, floor is left alone.
  await page.locator('#toggle-add').click();
  await page.getByRole('button', { name: 'Xcel Platinum' }).click();
  await page.getByRole('tab', { name: /Floor/ }).click();
  await page.locator('input.skill-input[data-ev="fx"]').first().fill('round off');
  await page.locator('#skill-pop .pop-opt').first().click();
  await page.getByRole('tab', { name: /Beam/ }).click();
  await page.locator('select[data-example="bb"]').selectOption({ label: 'Xcel Gold' });
  await expect(page.locator('input.skill-input[data-ev="bb"]').first()).toHaveValue(/walkover/i);
  await expect(page.locator('.revalue-notice')).toContainText('Copied Balance Beam from Xcel Gold');
  await expect(page.locator('input.skill-input[data-ev="fx"]').first()).toHaveValue(/round/i);
  expect(errors).toEqual([]);
});

test('local mode: drag a level tab to reorder; the leftmost opens first', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./?local');
  await page.locator('.empty-editor').getByRole('button', { name: 'Add athlete' }).click();
  await page.locator('#f-name').fill('Order Test');
  await page.getByRole('button', { name: 'Xcel Gold' }).click();
  await page.locator('#toggle-add').click();
  await page.getByRole('button', { name: 'Xcel Platinum' }).click();
  const tabs = page.locator('.entry-tab');
  await expect(tabs).toHaveText([/Gold/, /Platinum/]);
  const from = await tabs.nth(1).boundingBox();
  const to = await tabs.nth(0).boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + 10, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(tabs).toHaveText([/Platinum/, /Gold/]);
  // Saved: after a reload Platinum is first and opens by default.
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.locator('.entry-tab')).toHaveText([/Platinum/, /Gold/]);
  await expect(page.locator('.entry-tab.active')).toHaveText(/Platinum/);
  // A plain click still opens a level.
  await page.locator('.entry-tab').nth(1).click();
  await expect(page.locator('.entry-tab.active')).toHaveText(/Gold/);
  expect(errors).toEqual([]);
});

// Without the offline copy (a private window, say): the page's PDF code is gone from the server.
test.describe('stale page', () => {
  test.use({ serviceWorkers: 'block' });
  test('a newer deploy replaced the PDF code: Export offers Reload instead of an error', async ({ page }) => {
    await page.goto('./?local');
    await page.route(/\/js\/chunks\/pdf-[^/]*\.js$/, (route) => route.fulfill({ status: 404, body: '' }));
    let dialog = '';
    page.on('dialog', (d) => { dialog = d.message(); d.dismiss(); });
    await page.locator('.empty-editor').getByRole('button', { name: 'Add athlete' }).click();
    await page.getByRole('button', { name: 'Xcel Gold' }).click();
    await page.locator('#export-all').click();
    await expect(page.locator('#error-toast')).toContainText('A new version of the planner is available');
    expect(dialog).toBe('');
  });
});

test('signed-out: the sign-in screen appears (Firebase loads)', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./');
  await expect(page.locator('#signin-btn')).toBeVisible();
  await expect(page.locator('#guest-btn')).toBeVisible();
  expect(errors.filter((e) => !/firestore|identitytoolkit|googleapis|ERR_/i.test(e))).toEqual([]);
});

test('offline: after one visit the planner opens and exports with no network', async ({ page, context }) => {
  const errors = watchErrors(page);
  await page.goto('./?local');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.locator('.empty-editor').getByRole('button', { name: 'Add athlete' }).click();
  await page.getByRole('button', { name: 'Xcel Gold' }).click();
  const download = page.waitForEvent('download'); // PDF code and worksheet come from the device
  await page.locator('#export-all').click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
  await context.setOffline(false);
  expect(errors).toEqual([]);
});

// The built page carries a Content-Security-Policy (tools/build_site.mjs): nothing the planner
// itself loads may be refused, including Google sign-in's script and frames.
const refused = (errors) => errors.filter((e) => /Content.Security.Policy|Refused to/i.test(e));

test('security: the policy is in place and blocks nothing the planner uses, sign-in included', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./');
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("object-src 'none'");
  expect(await page.locator('meta[name="referrer"]').getAttribute('content')).toBe('strict-origin-when-cross-origin');
  await expect(page.locator('#signin-btn')).toBeVisible();
  // Opening Google sign-in loads its helper script and frame in this page; close the popup.
  const popup = page.waitForEvent('popup', { timeout: 15000 }).catch(() => null);
  await page.locator('#signin-btn').click();
  (await popup)?.close();
  await page.waitForTimeout(2000);
  expect(refused(errors)).toEqual([]);
});

test('privacy: the notice is linked from the footer and sign-in screen', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./');
  await expect(page.locator('.signin-note a[href="privacy.html"]')).toBeVisible();
  // With the service worker in control too (it serves the planner for its own address only).
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.locator('.site-footer a[href="privacy.html"]').click();
  await expect(page.locator('h1')).toHaveText('Privacy');
  await expect(page.locator('main a[href$="NAIGCPrivacyPolicy.pdf"]')).toBeVisible();
  expect(refused(errors)).toEqual([]);
});

test('local mode: export my data; feedback sends no athlete name and no query', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./?local');
  await page.locator('.empty-editor').getByRole('button', { name: 'Add athlete' }).click();
  await page.locator('#f-name').fill('Private Name');
  await page.getByRole('button', { name: 'Xcel Gold' }).click();
  await page.waitForTimeout(1000); // saved
  await page.locator('.account-btn').click();
  const download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export my data' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^ucg-routine-planner-data-.*\.json$/);
  const data = JSON.parse(await (await import('node:fs/promises')).readFile(await file.path(), 'utf8'));
  expect(data.athletes.map((a) => a.name)).toEqual(['Private Name']);
  // Feedback: caught before it leaves.
  let sent = '';
  await page.route(/docs\.google\.com\/forms/, (route) => {
    sent = route.request().postData() || '';
    route.fulfill({ status: 200, body: '' });
  });
  await page.locator('.account-btn').click();
  await page.getByRole('menuitem', { name: 'Send feedback' }).click();
  await expect(page.locator('.feedback-note')).not.toContainText('Private Name');
  await page.locator('#feedback-dialog textarea').fill('Smoke test');
  await page.locator('#feedback-dialog [type=submit]').click();
  await expect(page.locator('#feedback-dialog')).toContainText('Thanks');
  const body = new URLSearchParams(sent);
  expect(sent).not.toContain('Private');
  expect([...body.values()].some((v) => v.includes('?local'))).toBe(false);
  expect([...body.values()].some((v) => /\/ucg-routine-planner\/$/.test(v))).toBe(true);
  expect(errors).toEqual([]);
});

test('calibration: judge practice loads, checks a D-score and lays out the routine', async ({ page }) => {
  const errors = watchErrors(page);
  // The routine videos are Drive embeds: stand in for them here.
  await page.route(/drive\.google\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>video</title>' }));
  await page.goto('./calibration/infinity#BB_2'); // no trailing slash: redirected, as on GitHub Pages
  await expect(page).toHaveURL(/calibration\/infinity\/#BB_2$/);
  await expect(page.locator('#cp-video')).toHaveAttribute('src', /drive\.google\.com\/file\/d\/.+\/preview/);
  await expect(page.locator('#cp-main')).toHaveClass(/is-portrait/);
  const step = (letter, n) => page.locator(`[data-letter="${letter}"] [data-step="1"]`).click({ clickCount: n });
  await step('E', 2);
  await step('C', 4);
  await step('B', 1);
  for (const k of ['I', 'II', 'III']) await page.locator(`[data-eg="${k}"] input`).check();
  await expect(page.locator('#cp-d')).toHaveText('5.00');
  await page.getByRole('button', { name: 'Did I get it right?' }).click();
  await expect(page.locator('.cp-verdict')).toContainText('Off by 0.90');
  await expect(page.locator('[data-letter="B"]')).toHaveClass(/is-wrong/);
  await expect(page.locator('[data-letter="B"] .cp-key')).toHaveText('Key: 2');
  await expect(page.locator('[data-eg="IV"]')).toHaveClass(/is-wrong/);
  await page.getByRole('button', { name: 'See the routine laid out' }).click();
  await expect(page.locator('.cp-sum-total')).toContainText('15.9');
  await expect(page.locator('.cp-warn')).toHaveCount(0);
  // Open in the Routine Planner: that routine alone, nothing to sign in to or save, and back.
  await page.getByRole('link', { name: /Open in Routine Planner/ }).click();
  await expect(page).toHaveURL(/\?calibration=BB_2$/);
  await expect(page.locator('#calibration-banner')).toContainText('Calibration routine BB_2');
  await expect(page.locator('[data-routine="bb"] [data-calc="src"]').first()).toBeVisible();
  await expect(page.locator('#guest-banner')).toBeHidden();
  await expect(page.locator('[data-signin]:visible')).toHaveCount(0);
  await expect(page.locator('#save-status')).toHaveText('Not saved: a copy to look at');
  await expect(page.locator('[data-sv="bb"]')).toHaveText('15.9');
  await page.getByRole('link', { name: 'Back to judge practice' }).click();
  await expect(page).toHaveURL(/calibration\/infinity\/#BB_2$/);
  await expect(page.locator('#cp-video-name')).toHaveText('Beam · BB_2');
  // A landscape video gets the wide layout; deductions are off here; progress was kept.
  await page.locator('.cp-routine[data-id="BB_4"]').click();
  await expect(page.locator('#cp-main')).toHaveClass(/is-landscape/);
  await expect(page.locator('.cp-routine[data-id="BB_2"]')).toHaveClass(/is-off/);
  await expect(page.locator('.cp-deductions input')).toBeDisabled();
  expect(errors).toEqual([]);
});
