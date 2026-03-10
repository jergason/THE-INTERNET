import { serveLandingPage } from "./landing";
import { handleProxy } from "./proxy";

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // landing page
    if (path === "/" || path === "") {
      return serveLandingPage();
    }

    // proxy route
    if (path.startsWith("/browse/")) {
      const targetUrl = path.slice("/browse/".length) + url.search;
      if (!targetUrl) {
        return new Response("MISSING URL", { status: 400 });
      }
      return handleProxy(decodeURIComponent(targetUrl), request);
    }

    // favicon
    if (path === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    return new Response("NOT FOUND", { status: 404 });
  },
};
