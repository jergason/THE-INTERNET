export const uppercaseScript = `
(function() {
  'use strict';

  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'NOSCRIPT', 'SVG', 'INPUT', 'SELECT', 'OPTION']);
  const UPPERCASE_ATTRS = ['alt', 'title', 'placeholder', 'aria-label', 'aria-placeholder'];
  const PROXY_PREFIX = '/browse/';

  function shouldSkip(node) {
    let el = node.nodeType === 3 ? node.parentElement : node;
    while (el) {
      if (SKIP_TAGS.has(el.tagName)) return true;
      el = el.parentElement;
    }
    return false;
  }

  function uppercaseTextNode(node) {
    if (node.nodeType !== 3) return;
    if (shouldSkip(node)) return;
    const val = node.nodeValue;
    if (val && val !== val.toUpperCase()) {
      node.nodeValue = val.toUpperCase();
    }
  }

  function uppercaseAttributes(el) {
    if (!(el instanceof Element)) return;
    UPPERCASE_ATTRS.forEach(function(attr) {
      const v = el.getAttribute(attr);
      if (v && v !== v.toUpperCase()) {
        el.setAttribute(attr, v.toUpperCase());
      }
    });
  }

  function walkAndUppercase(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var node;
    while (node = walker.nextNode()) {
      uppercaseTextNode(node);
    }
    var els = root.querySelectorAll ? root.querySelectorAll('*') : [];
    els.forEach(uppercaseAttributes);
  }

  // initial pass
  if (document.body) walkAndUppercase(document.body);

  // mutation observer with rAF debounce
  var pending = false;
  var observer = new MutationObserver(function(mutations) {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function() {
      pending = false;
      mutations.forEach(function(m) {
        if (m.type === 'characterData') {
          uppercaseTextNode(m.target);
        }
        if (m.addedNodes) {
          m.addedNodes.forEach(function(n) {
            if (n.nodeType === 3) uppercaseTextNode(n);
            else if (n.nodeType === 1) {
              uppercaseAttributes(n);
              walkAndUppercase(n);
            }
          });
        }
      });
    });
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      walkAndUppercase(document.body);
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    });
  }

  // notify parent of URL changes (back/forward, pushState, etc)
  function postCurrentUrl() {
    var path = window.location.pathname;
    if (path.startsWith(PROXY_PREFIX)) {
      var realUrl = path.slice(PROXY_PREFIX.length) + window.location.search + window.location.hash;
      try { window.top.postMessage({ type: 'navigate', url: realUrl }, '*'); } catch(ex) {}
    }
  }
  window.addEventListener('popstate', postCurrentUrl);

  // navigation interception — post to parent frame
  document.addEventListener('click', function(e) {
    var link = e.target.closest ? e.target.closest('a') : null;
    if (!link) return;
    var href = link.getAttribute('href');
    if (!href) return;
    // already proxied — just tell parent the real URL
    if (href.startsWith(PROXY_PREFIX)) {
      var realUrl = href.slice(PROXY_PREFIX.length);
      try { window.top.postMessage({ type: 'navigate', url: realUrl }, '*'); } catch(ex) {}
      return;
    }
    // resolve via the same logic as fetch/XHR
    var resolved = resolveForProxy(href);
    if (resolved !== href) {
      e.preventDefault();
      var navigateUrl = resolved.startsWith(PROXY_PREFIX) ? resolved.slice(PROXY_PREFIX.length) : href;
      try { window.top.postMessage({ type: 'navigate', url: navigateUrl }, '*'); } catch(ex) {}
      window.location.href = resolved;
    }
  }, true);

  // resolve any URL to a proxied URL
  function resolveForProxy(url) {
    if (!url || url.startsWith(PROXY_PREFIX) || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('javascript:') || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:')) {
      return url;
    }
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
      return PROXY_PREFIX + url;
    }
    // relative URL — resolve against the target origin
    var path = window.location.pathname;
    if (path.startsWith(PROXY_PREFIX)) {
      var targetUrl = path.slice(PROXY_PREFIX.length) + window.location.search;
      try {
        var resolved = new URL(url, targetUrl).href;
        return PROXY_PREFIX + resolved;
      } catch(e) {}
    }
    return url;
  }

  // patch fetch
  var origFetch = window.fetch;
  window.fetch = function(input, init) {
    if (typeof input === 'string') {
      input = resolveForProxy(input);
    } else if (input instanceof Request && !input.url.includes(PROXY_PREFIX)) {
      input = new Request(resolveForProxy(input.url), input);
    }
    return origFetch.call(this, input, init);
  };

  // patch XHR
  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (typeof url === 'string') {
      url = resolveForProxy(url);
    }
    return origOpen.apply(this, [method, url, ...Array.prototype.slice.call(arguments, 2)]);
  };
})();
`;
