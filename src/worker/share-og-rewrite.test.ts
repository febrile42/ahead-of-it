// D-057 item 6 (DIA-235): proves src/worker/index.ts's `/` route actually
// rewrites the three meta tags, end to end — src/worker/share-og.test.ts
// only covers the pure URL math, and src/worker/index.test.ts's header
// explains why a real `wrangler dev`/workerd isn't available in this
// environment (same limit PH3-04 hit).
//
// `HTMLRewriter` is a Workers-runtime global, not something Node/vitest
// has. FakeHTMLRewriter below is a narrow stand-in: it supports exactly the
// `tag[attr="value"]` selector shape and `element.setAttribute` that
// src/worker/index.ts uses, and nothing more — it is not a general
// HTMLRewriter polyfill and must not be treated as proof this runs
// correctly under real workerd (that is QA/staging's job, DIA-237).
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index';
import type { Env } from './index';

const META_TAG = /<meta\b[^>]*>/gi;
const SELECTOR = /^(\w+)\[(\w+)="([^"]*)"\]$/;

class FakeElement {
  attrs: Record<string, string>;
  constructor(attrs: Record<string, string>) {
    this.attrs = attrs;
  }
  setAttribute(name: string, value: string): void {
    this.attrs[name] = value;
  }
  serialize(): string {
    const pairs = Object.entries(this.attrs).map(([k, v]) => `${k}="${v}"`);
    return `<meta ${pairs.join(' ')} />`;
  }
}

function parseAttrs(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrPattern = /([\w:-]+)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = attrPattern.exec(tag))) attrs[m[1]] = m[2];
  return attrs;
}

interface FakeHandlers {
  element?: (el: FakeElement) => void;
}

class FakeHTMLRewriter {
  // Keeps each original `handlers` object (not just its `.element`
  // function) so `handlers.element(el)` below is a proper method call —
  // pulling the function out on its own would drop the original `this`
  // and, since the tuple below also happens to have its own `value` field,
  // silently read the wrong one instead of throwing.
  private handlers: Array<{ tag: string; attr: string; value: string; handlers: FakeHandlers }> = [];

  on(selector: string, handlers: FakeHandlers): this {
    const match = SELECTOR.exec(selector);
    if (!match || !handlers.element) throw new Error(`FakeHTMLRewriter: unsupported selector "${selector}"`);
    const [, tag, attr, value] = match;
    this.handlers.push({ tag, attr, value, handlers });
    return this;
  }

  transform(response: Response): Response {
    const handlers = this.handlers;
    // Real HTMLRewriter.transform() is synchronous and streams the body as
    // it parses; reading `response.text()` is inherently async, so this
    // fake defers the rewrite into the returned Response's own stream
    // instead of trying to be synchronous — callers only ever `await
    // res.text()`, same as they would against a real streamed body.
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const html = await response.text();
        const rewritten = html.replace(META_TAG, (tag) => {
          if (!/^<meta\b/i.test(tag)) return tag;
          const attrs = parseAttrs(tag);
          for (const handler of handlers) {
            if (attrs[handler.attr] === handler.value) {
              const el = new FakeElement({ ...attrs });
              handler.handlers.element!(el);
              return el.serialize();
            }
          }
          return tag;
        });
        controller.enqueue(new TextEncoder().encode(rewritten));
        controller.close();
      },
    });
    return new Response(stream, response);
  }
}

function makeEnv(html: string): Env {
  return {
    ASSETS: { fetch: vi.fn(async () => new Response(html, { headers: { 'Content-Type': 'text/html' } })) },
  };
}

const FIXTURE_HTML = `<!doctype html><html><head>
<meta property="og:title" content="Ahead of It" />
<meta property="og:image" content="https://example.test/share/80.png" />
<meta name="twitter:image" content="https://example.test/share/80.png" />
<meta property="og:url" content="https://example.test/?n=80" />
<meta property="og:image:alt" content="the caption, unaffected by band" />
</head><body></body></html>`;

describe('GET / rewrites og:image / twitter:image / og:url (D-057 item 6)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rewrites all three tags to the requested stop, leaves og:title/og:image:alt untouched', async () => {
    vi.stubGlobal('HTMLRewriter', FakeHTMLRewriter);
    const env = makeEnv(FIXTURE_HTML);

    const res = await worker.fetch(new Request('https://example.test/?n=610'), env);
    const html = await res.text();

    expect(html).toContain('<meta property="og:title" content="Ahead of It" />');
    // A trailing `?v=<hash>` is expected once src/worker/share-hashes.json
    // has a real entry for 610 (written by npm run share:render) — this
    // only asserts the base URL, not the hash value itself (that's
    // share-og.test.ts's job), so a re-render never flakes this test.
    expect(html).toMatch(/content="https:\/\/example\.test\/share\/610\.png(\?v=\w+)?"/);
    expect(html.match(/share\/610\.png/g)).toHaveLength(2); // og:image + twitter:image
    expect(html).toContain('property="og:url" content="https://example.test/?n=610"');
    expect(html).toContain('content="the caption, unaffected by band"');
  });

  it('appends &it=none for the without state', async () => {
    vi.stubGlobal('HTMLRewriter', FakeHTMLRewriter);
    const env = makeEnv(FIXTURE_HTML);

    const res = await worker.fetch(new Request('https://example.test/?n=220&it=none'), env);
    const html = await res.text();

    expect(html).toContain('property="og:url" content="https://example.test/?n=220&it=none"');
  });

  it('falls back to the untouched static HTML if HTMLRewriter throws', async () => {
    vi.stubGlobal(
      'HTMLRewriter',
      class {
        on(): this {
          return this;
        }
        transform(): never {
          throw new Error('boom');
        }
      }
    );
    const env = makeEnv(FIXTURE_HTML);

    const res = await worker.fetch(new Request('https://example.test/?n=610'), env);
    const html = await res.text();

    expect(html).toBe(FIXTURE_HTML);
  });
});
