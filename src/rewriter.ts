import { resolveAndProxy } from "./utils";
import { uppercaseScript } from "./uppercase-script";

const SKIP_TAGS = new Set(["script", "style", "code", "pre", "textarea", "noscript", "svg"]);

// matches html entities: &amp; &#x27; &#160; &nbsp; etc
const ENTITY_PATTERN = /&(?:#(?:x[0-9a-fA-F]+|[0-9]+)|[a-zA-Z][a-zA-Z0-9]*);/g;

function uppercasePreservingEntities(raw: string): string {
  return raw.replace(ENTITY_PATTERN, (e) => `\x00${e}\x00`)
    .split("\x00")
    .map((part, i) => (i % 2 === 0 ? part.toUpperCase() : part))
    .join("");
}

export class TextUppercaser implements HTMLRewriterElementContentHandlers {
  private depth = 0;
  private skipDepth = 0;

  element(el: Element) {
    if (SKIP_TAGS.has(el.tagName)) {
      if (this.skipDepth === 0) this.depth++;
      this.skipDepth++;
    }
  }

  text(text: Text) {
    if (this.skipDepth > 0) {
      return;
    }
    if (text.text) {
      text.replace(uppercasePreservingEntities(text.text), { html: true });
    }
  }
}

// separate instance per tag to track skip nesting properly
export class SkipAwareTextUppercaser {
  private skipping = false;

  forElement(tagName: string): HTMLRewriterElementContentHandlers {
    if (SKIP_TAGS.has(tagName)) {
      return {
        element: () => {
          this.skipping = true;
        },
        text: () => {},
      };
    }
    return {
      text: (text: Text) => {
        if (text.text) {
          text.replace(uppercasePreservingEntities(text.text), { html: true });
        }
      },
    };
  }
}

export class SimpleTextUppercaser implements HTMLRewriterElementContentHandlers {
  text(text: Text) {
    if (text.text) {
      text.replace(uppercasePreservingEntities(text.text), { html: true });
    }
  }
}

export class AttributeUppercaser implements HTMLRewriterElementContentHandlers {
  private attrs = ["alt", "title", "placeholder", "aria-label", "aria-placeholder"];

  element(el: Element) {
    this.attrs.forEach((attr) => {
      const v = el.getAttribute(attr);
      if (v) el.setAttribute(attr, v.toUpperCase());
    });
  }
}

export class URLRewriter implements HTMLRewriterElementContentHandlers {
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

export class SrcsetRewriter implements HTMLRewriterElementContentHandlers {
  constructor(private baseUrl: string) {}

  element(el: Element) {
    const srcset = el.getAttribute("srcset");
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
    el.setAttribute("srcset", rewritten);
  }
}

export class HeadInjector implements HTMLRewriterElementContentHandlers {
  constructor(private targetUrl: string) {}

  element(el: Element) {
    // no <base> tag — it would redirect /browse/... paths to the target origin
    // URLRewriter already resolves all relative URLs to absolute proxy paths
    el.append(
      `<style>*:not(input):not(textarea):not(select):not(code):not(pre):not(script):not(style) { text-transform: uppercase !important; }</style>`,
      { html: true },
    );
    el.append(`<script>${uppercaseScript}</script>`, { html: true });
  }
}

export class MetaCSPRemover implements HTMLRewriterElementContentHandlers {
  element(el: Element) {
    const equiv = el.getAttribute("http-equiv");
    if (equiv && equiv.toLowerCase().includes("content-security-policy")) {
      el.remove();
    }
  }
}

export function buildRewriter(targetUrl: string): HTMLRewriter {
  return new HTMLRewriter()
    .on("head", new HeadInjector(targetUrl))
    .on("meta", new MetaCSPRemover())
    .on("a, area", new URLRewriter(targetUrl, "href"))
    .on("img", new URLRewriter(targetUrl, "src"))
    .on("img, source", new SrcsetRewriter(targetUrl))
    .on("video", new URLRewriter(targetUrl, "src"))
    .on("video", new URLRewriter(targetUrl, "poster"))
    .on("audio", new URLRewriter(targetUrl, "src"))
    .on("source", new URLRewriter(targetUrl, "src"))
    .on("script", new URLRewriter(targetUrl, "src"))
    .on("link", new URLRewriter(targetUrl, "href"))
    .on("form", new URLRewriter(targetUrl, "action"))
    .on("iframe", new URLRewriter(targetUrl, "src"))
    .on("[alt], [title], [placeholder], [aria-label]", new AttributeUppercaser())
    .on("body *", new SimpleTextUppercaser());
}
