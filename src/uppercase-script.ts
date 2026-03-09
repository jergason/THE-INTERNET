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

  // navigation interception — post to parent frame
  document.addEventListener('click', function(e) {
    var link = e.target.closest ? e.target.closest('a') : null;
    if (!link) return;
    var href = link.getAttribute('href');
    if (!href) return;
    // let proxy-rewritten links work naturally in the iframe
    if (href.startsWith(PROXY_PREFIX)) {
      // extract the real URL and tell the parent to update the URL bar
      var realUrl = href.slice(PROXY_PREFIX.length);
      try {
        window.top.postMessage({ type: 'navigate', url: realUrl }, '*');
      } catch(ex) {}
      return;
    }
    // absolute external link not yet rewritten
    if (href.startsWith('http://') || href.startsWith('https://')) {
      e.preventDefault();
      var proxied = PROXY_PREFIX + href;
      try {
        window.top.postMessage({ type: 'navigate', url: href }, '*');
      } catch(ex) {}
      window.location.href = proxied;
    }
  }, true);

  // patch fetch
  var origFetch = window.fetch;
  window.fetch = function(input, init) {
    if (typeof input === 'string' && (input.startsWith('http://') || input.startsWith('https://'))) {
      input = PROXY_PREFIX + input;
    } else if (input instanceof Request && (input.url.startsWith('http://') || input.url.startsWith('https://')) && !input.url.includes(PROXY_PREFIX)) {
      input = new Request(PROXY_PREFIX + input.url, input);
    }
    return origFetch.call(this, input, init);
  };

  // patch XHR
  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://')) && !url.includes(PROXY_PREFIX)) {
      url = PROXY_PREFIX + url;
    }
    return origOpen.apply(this, [method, url, ...Array.prototype.slice.call(arguments, 2)]);
  };
})();
`;
