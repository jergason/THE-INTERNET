// HTMLRewriter getAttribute() returns raw HTML — entities aren't decoded.
// HN (and others) encode slashes as &#x2F; which breaks URL parsing.
const NAMED_ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'",
};

export function decodeHTMLEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&(?:amp|lt|gt|quot|apos);/g, (e) => NAMED_ENTITIES[e] ?? e);
}

function resolveUrl(relative: string, base: string): string {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

function proxyUrl(targetUrl: string): string {
  return `/browse/${targetUrl}`;
}

export function resolveAndProxy(raw: string, baseUrl: string): string {
  const relative = decodeHTMLEntities(raw);
  if (
    !relative ||
    relative.startsWith("data:") ||
    relative.startsWith("javascript:") ||
    relative.startsWith("mailto:") ||
    relative.startsWith("#") ||
    relative.startsWith("blob:")
  ) {
    return relative;
  }
  const resolved = resolveUrl(relative, baseUrl);
  return proxyUrl(resolved);
}

export function stripHeaders(headers: Headers): Headers {
  const stripped = new Headers(headers);
  const remove = [
    "content-security-policy",
    "content-security-policy-report-only",
    "x-frame-options",
    "x-content-type-options",
    "strict-transport-security",
    "permissions-policy",
    "cross-origin-embedder-policy",
    "cross-origin-opener-policy",
    "cross-origin-resource-policy",
  ];
  remove.forEach((h) => stripped.delete(h));
  stripped.set("referrer-policy", "no-referrer");
  stripped.set("access-control-allow-origin", "*");
  return stripped;
}


export function forwardHeaders(request: Request): HeadersInit {
  const forwarded: Record<string, string> = {};
  const pass = ["user-agent", "accept", "accept-language", "accept-encoding", "cookie", "referer"];
  pass.forEach((h) => {
    const v = request.headers.get(h);
    if (v) forwarded[h] = v;
  });
  return forwarded;
}
