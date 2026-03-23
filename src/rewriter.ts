import { resolveAndProxy } from "./utils";
import { uppercaseScript } from "./uppercase-script";

// split on html entities, uppercase only the non-entity segments
const ENTITY_PATTERN = /(&(?:#(?:x[0-9a-fA-F]+|[0-9]+)|[a-zA-Z][a-zA-Z0-9]*);)/g;

export function uppercasePreservingEntities(raw: string): string {
  return raw
    .split(ENTITY_PATTERN)
    .map((part, i) => (i % 2 === 0 ? part.toUpperCase() : part))
    .join("");
}

class SkipElementTracker implements HTMLRewriterElementContentHandlers {
  constructor(private uppercaser: TextUppercaser) {}

  element(el: Element) {
    this.uppercaser.skipDepth++;
    el.onEndTag(() => {
      this.uppercaser.skipDepth--;
    });
  }
}

class TextUppercaser implements HTMLRewriterElementContentHandlers {
  skipDepth = 0;

  text(text: Text) {
    if (this.skipDepth > 0) return;
    if (text.text) {
      text.replace(uppercasePreservingEntities(text.text), { html: true });
    }
  }
}

class AttributeUppercaser implements HTMLRewriterElementContentHandlers {
  private attrs = ["alt", "title", "placeholder", "aria-label", "aria-placeholder"];

  element(el: Element) {
    this.attrs.forEach((attr) => {
      const v = el.getAttribute(attr);
      if (v) el.setAttribute(attr, v.toUpperCase());
    });
  }
}

class URLRewriter implements HTMLRewriterElementContentHandlers {
  constructor(
    private baseUrl: string,
    private attr: string,
  ) {}

  element(el: Element) {
    const val = el.getAttribute(this.attr);
    if (val) {
      el.setAttribute(this.attr, resolveAndProxy(val, this.baseUrl));
    }
  }
}

class SrcsetRewriter implements HTMLRewriterElementContentHandlers {
  constructor(
    private baseUrl: string,
    private attr: string = "srcset",
  ) {}

  element(el: Element) {
    const srcset = el.getAttribute(this.attr);
    if (!srcset) return;
    const rewritten = srcset
      .split(",")
      .map((entry) => {
        const parts = entry.trim().split(/\s+/);
        if (parts.length >= 1) {
          parts[0] = resolveAndProxy(parts[0], this.baseUrl);
        }
        return parts.join(" ");
      })
      .join(", ");
    el.setAttribute(this.attr, rewritten);
  }
}

class HeadInjector implements HTMLRewriterElementContentHandlers {
  constructor(private targetUrl: string) {}

  element(el: Element) {
    // no <base> tag — it would redirect /browse/... paths to the target origin
    // URLRewriter already resolves all relative URLs to absolute proxy paths
    el.append(
      `<style>*:not(input):not(textarea):not(select):not(code):not(pre):not(script):not(style) { text-transform: uppercase !important; } code, pre, textarea, svg { text-transform: none !important; }</style>`,
      { html: true },
    );
    el.append(`<script>${uppercaseScript}</script>`, { html: true });
  }
}

class MetaCSPRemover implements HTMLRewriterElementContentHandlers {
  element(el: Element) {
    const equiv = el.getAttribute("http-equiv");
    if (equiv && equiv.toLowerCase().includes("content-security-policy")) {
      el.remove();
    }
  }
}

export function buildRewriter(targetUrl: string): HTMLRewriter {
  const uppercaser = new TextUppercaser();
  return new HTMLRewriter()
    .on("head", new HeadInjector(targetUrl))
    .on("meta", new MetaCSPRemover())
    .on("a, area", new URLRewriter(targetUrl, "href"))
    .on("img", new URLRewriter(targetUrl, "src"))
    .on("img, source", new URLRewriter(targetUrl, "data-src"))
    .on("img, source", new SrcsetRewriter(targetUrl))
    .on("img, source", new SrcsetRewriter(targetUrl, "data-srcset"))
    .on("video", new URLRewriter(targetUrl, "src"))
    .on("video", new URLRewriter(targetUrl, "poster"))
    .on("audio", new URLRewriter(targetUrl, "src"))
    .on("source", new URLRewriter(targetUrl, "src"))
    .on("script", new URLRewriter(targetUrl, "src"))
    .on("link", new URLRewriter(targetUrl, "href"))
    .on("form", new URLRewriter(targetUrl, "action"))
    .on("iframe", new URLRewriter(targetUrl, "src"))
    .on("[alt], [title], [placeholder], [aria-label]", new AttributeUppercaser())
    .on("script, style, code, pre, textarea, noscript, svg", new SkipElementTracker(uppercaser))
    .on("body *", uppercaser);
}
