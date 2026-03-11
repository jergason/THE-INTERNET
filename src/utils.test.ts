import { describe, it, expect } from "vitest";
import { decodeHTMLEntities, resolveAndProxy } from "./utils";

const HN_BASE = "https://news.ycombinator.com/item?id=47309953";

describe("decodeHTMLEntities", () => {
  it("decodes hex entities (&#x2F; → /)", () => {
    expect(decodeHTMLEntities("https:&#x2F;&#x2F;x.com")).toBe("https://x.com");
  });

  it("decodes HN-style fully-encoded URLs", () => {
    expect(
      decodeHTMLEntities(
        "https:&#x2F;&#x2F;x.com&#x2F;garrytan&#x2F;status&#x2F;2023518514120937672?s=20",
      ),
    ).toBe("https://x.com/garrytan/status/2023518514120937672?s=20");
  });

  it("decodes decimal entities (&#47; → /)", () => {
    expect(decodeHTMLEntities("https:&#47;&#47;example.com")).toBe("https://example.com");
  });

  it("decodes named entities", () => {
    expect(decodeHTMLEntities("a&amp;b&lt;c&gt;d&quot;e&apos;f")).toBe("a&b<c>d\"e'f");
  });

  it("passes through strings with no entities", () => {
    expect(decodeHTMLEntities("https://example.com/path?q=1")).toBe("https://example.com/path?q=1");
  });

  it("handles &#x27; (apostrophe, common in HN)", () => {
    expect(decodeHTMLEntities("it&#x27;s")).toBe("it's");
  });

  it("handles mixed entities and plain text", () => {
    expect(decodeHTMLEntities("https:&#x2F;&#x2F;example.com/already-decoded&#x2F;path")).toBe(
      "https://example.com/already-decoded/path",
    );
  });
});

describe("resolveAndProxy with HN-encoded URLs", () => {
  it("resolves HN hex-encoded absolute URL to correct proxy path", () => {
    const raw = "https:&#x2F;&#x2F;denchclaw.com";
    expect(resolveAndProxy(raw, HN_BASE)).toBe("/browse/https://denchclaw.com/");
  });

  it("resolves HN hex-encoded URL with path", () => {
    const raw = "https:&#x2F;&#x2F;x.com&#x2F;garrytan&#x2F;status&#x2F;2023518514120937672?s=20";
    expect(resolveAndProxy(raw, HN_BASE)).toBe(
      "/browse/https://x.com/garrytan/status/2023518514120937672?s=20",
    );
  });

  it("resolves HN hex-encoded youtube URL", () => {
    const raw = "https:&#x2F;&#x2F;www.youtube.com&#x2F;watch?v=pFActBC3bH4#t=43";
    expect(resolveAndProxy(raw, HN_BASE)).toBe(
      "/browse/https://www.youtube.com/watch?v=pFActBC3bH4#t=43",
    );
  });

  it("still resolves normal relative paths", () => {
    expect(resolveAndProxy("/item?id=123", HN_BASE)).toBe(
      "/browse/https://news.ycombinator.com/item?id=123",
    );
  });

  it("still resolves normal absolute URLs", () => {
    expect(resolveAndProxy("https://example.com", HN_BASE)).toBe("/browse/https://example.com/");
  });

  it("passes through data: URIs", () => {
    expect(resolveAndProxy("data:image/png;base64,abc", HN_BASE)).toBe("data:image/png;base64,abc");
  });

  it("passes through javascript: URIs", () => {
    expect(resolveAndProxy("javascript:void(0)", HN_BASE)).toBe("javascript:void(0)");
  });

  it("passes through fragment-only links", () => {
    expect(resolveAndProxy("#top", HN_BASE)).toBe("#top");
  });

  it("passes through empty string", () => {
    expect(resolveAndProxy("", HN_BASE)).toBe("");
  });
});
