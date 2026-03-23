import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { unstable_dev, type Unstable_DevWorker } from "wrangler";
import { uppercasePreservingEntities } from "./rewriter";

describe("uppercasePreservingEntities", () => {
  it("uppercases plain text", () => {
    expect(uppercasePreservingEntities("hello world")).toBe("HELLO WORLD");
  });

  it("preserves named HTML entities", () => {
    expect(uppercasePreservingEntities("a &amp; b")).toBe("A &amp; B");
  });

  it("preserves hex entities", () => {
    expect(uppercasePreservingEntities("it&#x27;s fine")).toBe("IT&#x27;S FINE");
  });

  it("preserves decimal entities", () => {
    expect(uppercasePreservingEntities("100&#37; done")).toBe("100&#37; DONE");
  });

  it("handles mixed entities and text", () => {
    expect(uppercasePreservingEntities("a &lt; b &gt; c")).toBe("A &lt; B &gt; C");
  });

  it("returns empty string unchanged", () => {
    expect(uppercasePreservingEntities("")).toBe("");
  });
});

describe("HTMLRewriter integration", () => {
  let worker: Unstable_DevWorker;

  beforeAll(async () => {
    worker = await unstable_dev("src/index.ts", {
      experimental: { disableExperimentalWarning: true },
    });
  });

  afterAll(async () => {
    await worker?.stop();
  });

  it("uppercases regular text in proxied HTML", async () => {
    const resp = await worker.fetch("/browse/https://httpbin.org/html");
    if (resp.status !== 200) return; // skip if httpbin is down
    const html = await resp.text();
    // httpbin /html returns a page with "Herman Melville" — should be uppercased
    expect(html).toContain("HERMAN MELVILLE");
  });

  it("preserves inline script content in body", async () => {
    const resp = await worker.fetch("/browse/https://www.wikipedia.org");
    if (resp.status !== 200) return;
    const html = await resp.text();
    // wikipedia has inline scripts with 'var' — should NOT be uppercased
    expect(html).toContain("var ");
    expect(html).not.toMatch(/\bVAR rtlLangs\b/);
  });

  it("preserves inline style content in body", async () => {
    const resp = await worker.fetch("/browse/https://www.wikipedia.org");
    if (resp.status !== 200) return;
    const html = await resp.text();
    // wikipedia has inline styles — should NOT be uppercased
    expect(html).toMatch(/display:\s*block/i);
    expect(html).not.toMatch(/DISPLAY:\s*BLOCK/);
  });

  it("injects CSS with text-transform reset for code/pre", async () => {
    const resp = await worker.fetch("/browse/https://httpbin.org/html");
    if (resp.status !== 200) return;
    const html = await resp.text();
    expect(html).toContain("text-transform: none !important");
    expect(html).toContain("text-transform: uppercase !important");
  });

  it("returns 400 for missing URL", async () => {
    const resp = await worker.fetch("/browse/");
    expect(resp.status).toBe(400);
  });

  it("returns 404 for unknown routes", async () => {
    const resp = await worker.fetch("/unknown");
    expect(resp.status).toBe(404);
  });

  it("returns 200 for landing page", async () => {
    const resp = await worker.fetch("/");
    expect(resp.status).toBe(200);
    const html = await resp.text();
    expect(html).toContain("THE INTERNET");
  });

  it("rewrites links to proxy URLs", async () => {
    const resp = await worker.fetch("/browse/https://httpbin.org/html");
    if (resp.status !== 200) return;
    const html = await resp.text();
    // links should be rewritten to /browse/ prefix
    expect(html).toContain("/browse/");
  });

  it("strips security headers", async () => {
    const resp = await worker.fetch("/browse/https://httpbin.org/html");
    if (resp.status !== 200) return;
    expect(resp.headers.get("x-frame-options")).toBeNull();
    expect(resp.headers.get("content-security-policy")).toBeNull();
    expect(resp.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("does not double-inject CSS when both head and body exist", async () => {
    const resp = await worker.fetch("/browse/https://httpbin.org/html");
    if (resp.status !== 200) return;
    const html = await resp.text();
    const cssCount = (html.match(/text-transform: uppercase/g) || []).length;
    expect(cssCount).toBe(1);
    const scriptCount = (html.match(/walkAndUppercase/g) || []).length;
    // walkAndUppercase appears multiple times within the single script (definition + calls)
    // but should NOT appear in a second duplicate script block
    expect(scriptCount).toBeGreaterThan(0);
    expect(scriptCount).toBeLessThan(10);
  });

  it("injects resolveForProxy for relative URL handling", async () => {
    const resp = await worker.fetch("/browse/https://httpbin.org/html");
    if (resp.status !== 200) return;
    const html = await resp.text();
    expect(html).toContain("function resolveForProxy");
    expect(html).toContain("new URL(url, targetUrl)");
  });

  it("rewrites data-src attributes for lazy-loaded images", async () => {
    const resp = await worker.fetch("/browse/https://www.wired.com");
    if (resp.status !== 200) return;
    const html = await resp.text();
    const dataSrcMatches = html.match(/data-src="([^"]*)"/g) || [];
    if (dataSrcMatches.length === 0) return; // skip if wired changed their pattern
    const allProxied = dataSrcMatches.every((m) => m.includes("/browse/"));
    expect(allProxied).toBe(true);
  });
});
