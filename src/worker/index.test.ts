// PH3-04 (DIA-230): the /u/* proxy's routing logic, exercised directly
// (no wrangler dev / live Worker — not available in this environment; see
// src/worker/index.ts's header comment). `fetch` is a global here (Node 22),
// stubbed per test the same way it would be inside the Worker runtime.
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index';
import type { Env } from './index';

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    ASSETS: { fetch: vi.fn(async (req: Request) => new Response(`asset:${new URL(req.url).pathname}`)) },
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /u/script.js', () => {
  it('404s with UMAMI_HOST unset (the no-op default, DIA-226/230)', async () => {
    const env = makeEnv();
    const res = await worker.fetch(new Request('https://example.test/u/script.js'), env);
    expect(res.status).toBe(404);
    expect(env.ASSETS.fetch).not.toHaveBeenCalled();
  });

  it('proxies to {UMAMI_HOST}/script.js when configured', async () => {
    const fetchMock = vi.fn(async () => new Response('umami tracker js', { status: 200, headers: { 'Content-Type': 'application/javascript' } }));
    vi.stubGlobal('fetch', fetchMock);
    const env = makeEnv({ UMAMI_HOST: 'https://stats.example.com' });

    const res = await worker.fetch(new Request('https://example.test/u/script.js'), env);

    expect(fetchMock).toHaveBeenCalledWith('https://stats.example.com/script.js');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('umami tracker js');
    expect(res.headers.get('Cache-Control')).toContain('max-age');
  });
});

describe('POST /u/api/send', () => {
  it('404s with UMAMI_HOST unset', async () => {
    const env = makeEnv();
    const res = await worker.fetch(new Request('https://example.test/u/api/send', { method: 'POST', body: '{}' }), env);
    expect(res.status).toBe(404);
  });

  it('forwards the POST body to {UMAMI_HOST}/api/send', async () => {
    const fetchMock = vi.fn(async (_target: string, _init?: RequestInit) => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const env = makeEnv({ UMAMI_HOST: 'https://stats.example.com' });

    const res = await worker.fetch(
      new Request('https://example.test/u/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: { website: 'x', name: 'band_change' } }),
      }),
      env
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [target, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(target).toBe('https://stats.example.com/api/send');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ payload: { website: 'x', name: 'band_change' } }));
    expect(res.status).toBe(200);
  });

  it('only accepts POST — GET falls through to assets (no GET collect route)', async () => {
    const env = makeEnv();
    const res = await worker.fetch(new Request('https://example.test/u/api/send', { method: 'GET' }), env);
    expect(env.ASSETS.fetch).toHaveBeenCalledTimes(1);
    expect(await res.text()).toBe('asset:/u/api/send');
  });
});

describe('everything else', () => {
  it('delegates to env.ASSETS.fetch unchanged (R-26/D-018: same not_found_handling as before)', async () => {
    const env = makeEnv();
    const request = new Request('https://example.test/some/random/path');
    const res = await worker.fetch(request, env);
    expect(env.ASSETS.fetch).toHaveBeenCalledWith(request);
    expect(await res.text()).toBe('asset:/some/random/path');
  });

  it('serves / through assets, not the proxy', async () => {
    const env = makeEnv();
    await worker.fetch(new Request('https://example.test/'), env);
    expect(env.ASSETS.fetch).toHaveBeenCalledTimes(1);
  });
});
