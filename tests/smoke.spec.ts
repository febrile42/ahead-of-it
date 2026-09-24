import { expect, test } from '@playwright/test';

// R-21: no third-party requests. A grep of the source isn't enough — see
// joshgister PR #19, where Cloudflare injected an analytics beacon at the
// edge that never appears in the repo. This intercepts every request the
// real browser makes while loading the page and fails on any host that
// isn't the local preview server.
test('/ returns 200, renders the heading, and makes no third-party requests', async ({
  page,
}) => {
  const offOrigin: string[] = [];

  page.on('request', (request) => {
    const { hostname } = new URL(request.url());
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      offOrigin.push(request.url());
    }
  });

  const response = await page.goto('/');
  expect(response?.status()).toBe(200);

  await expect(page.locator('h1')).toHaveText('Ahead of It');
  await expect(page).toHaveTitle("Ahead of It — Josh Gister's résumé");

  expect(offOrigin).toEqual([]);
});
