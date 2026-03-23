import { stripHeaders, forwardHeaders, resolveAndProxy } from "./utils";
import { buildRewriter } from "./rewriter";

function rewriteCss(css: string, baseUrl: string): string {
  // rewrite url(...) references
  return css
    .replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g, (_match, quote, url) => {
      const rewritten = resolveAndProxy(url.trim(), baseUrl);
      return `url(${quote}${rewritten}${quote})`;
    })
    .replace(/@import\s+(['"])([^'"]+)\1/g, (_match, quote, url) => {
      const rewritten = resolveAndProxy(url.trim(), baseUrl);
      return `@import ${quote}${rewritten}${quote}`;
    });
}

function errorPage(message: string, status: number = 502): Response {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap');
    body {
      font-family: 'Patrick Hand', cursive;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; margin: 0;
      background: #fffef9; color: #333;
      text-align: center;
    }
    h1 { font-size: 3em; }
    p { font-size: 1.5em; }
  </style>
</head>
<body>
  <div>
    <h1>OOPS</h1>
    <p>${message.toUpperCase()}</p>
    <p style="font-size: 1em; color: #999;">THE INTERNET IS HAVING A BAD DAY</p>
  </div>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function handleProxy(targetUrl: string, request: Request): Promise<Response> {
  // ensure we have a protocol
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    targetUrl = "https://" + targetUrl;
  }

  let targetResponse: Response;
  try {
    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    targetResponse = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders(request),
      body: hasBody ? request.body : undefined,
      redirect: "manual",
    });
  } catch {
    return errorPage(`COULDN'T REACH ${targetUrl} — MAYBE IT DOESN'T EXIST, OR MAYBE IT'S HIDING`);
  }

  // handle redirects — rewrite Location header
  if (targetResponse.status >= 300 && targetResponse.status < 400) {
    const location = targetResponse.headers.get("location");
    if (location) {
      const resolved = new URL(location, targetUrl).href;
      return new Response(null, {
        status: targetResponse.status,
        headers: { location: `/browse/${resolved}` },
      });
    }
  }

  const responseHeaders = stripHeaders(new Headers(targetResponse.headers));
  const contentType = responseHeaders.get("content-type") || "";

  // HTML — run through rewriter
  if (contentType.includes("text/html")) {
    const rewriter = buildRewriter(targetUrl);
    const transformed = rewriter.transform(
      new Response(targetResponse.body, {
        status: targetResponse.status,
        headers: responseHeaders,
      }),
    );
    return transformed;
  }

  // CSS — rewrite url() references
  if (contentType.includes("text/css")) {
    const css = await targetResponse.text();
    const rewritten = rewriteCss(css, targetUrl);
    return new Response(rewritten, {
      status: targetResponse.status,
      headers: responseHeaders,
    });
  }

  // everything else — passthrough
  return new Response(targetResponse.body, {
    status: targetResponse.status,
    headers: responseHeaders,
  });
}
