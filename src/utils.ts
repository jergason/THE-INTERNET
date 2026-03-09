export function resolveUrl(relative: string, base: string): string {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

export function proxyUrl(targetUrl: string): string {
  return `/browse/${targetUrl}`;
}

export function resolveAndProxy(relative: string, baseUrl: string): string {
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

export function getTargetOrigin(targetUrl: string): string {
  try {
    const u = new URL(targetUrl);
    return u.origin;
  } catch {
    return "";
  }
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
