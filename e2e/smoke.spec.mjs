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
  const download = page.waitForEvent('download');
  await page.locator('#export-all').click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
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
