export function serveLandingPage(): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>THE INTERNET</title>
  <link href="https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/roughjs@4.6.6/bundled/rough.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Patrick Hand', cursive;
      background: #f5f0e8;
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px;
      overflow: hidden;
    }
    #title {
      font-size: clamp(2rem, 5vw, 3.5rem);
      color: #2a2a2a;
      transform: rotate(-1.5deg);
      margin-bottom: 4px;
      letter-spacing: 2px;
      user-select: none;
    }
    #subtitle {
      font-size: clamp(0.8rem, 2vw, 1.1rem);
      color: #888;
      margin-bottom: 10px;
      transform: rotate(0.5deg);
    }
    #browser-window {
      position: relative;
      width: min(95vw, 1100px);
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    #browser-canvas {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      z-index: 1;
    }
    #toolbar {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      min-height: 56px;
    }
    .nav-btn {
      background: none;
      border: none;
      font-family: 'Patrick Hand', cursive;
      font-size: 1.4rem;
      cursor: pointer;
      color: #333;
      padding: 2px 8px;
      position: relative;
    }
    .nav-btn:hover { color: #000; }
    .nav-btn:active { transform: scale(0.95); }
    #url-input {
      flex: 1;
      font-family: 'Patrick Hand', cursive;
      font-size: 1.1rem;
      border: none;
      background: transparent;
      outline: none;
      padding: 6px 12px;
      color: #333;
      position: relative;
      z-index: 2;
    }
    #url-input::placeholder {
      color: #aaa;
    }
    #go-btn {
      background: none;
      border: none;
      font-family: 'Patrick Hand', cursive;
      font-size: 1.3rem;
      cursor: pointer;
      color: #333;
      padding: 2px 12px;
      font-weight: bold;
    }
    #go-btn:hover { color: #000; }
    #iframe-container {
      position: relative;
      flex: 1;
      z-index: 2;
      margin: 0 4px 4px 4px;
      min-height: 0;
    }
    #content-frame {
      width: 100%;
      height: 100%;
      border: none;
      background: white;
      display: block;
    }
    #splash {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      background: white;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 3;
      font-family: 'Patrick Hand', cursive;
    }
    #splash h2 {
      font-size: clamp(1.2rem, 3vw, 2rem);
      color: #555;
      transform: rotate(-1deg);
    }
    #splash p {
      font-size: clamp(0.9rem, 2vw, 1.2rem);
      color: #999;
      margin-top: 8px;
    }
    #splash .arrow {
      font-size: 3rem;
      margin-bottom: 10px;
      animation: bounce 2s ease-in-out infinite;
    }
    @keyframes bounce {
      0%, 100% { transform: translateY(0) rotate(-5deg); }
      50% { transform: translateY(-10px) rotate(5deg); }
    }
  </style>
</head>
<body>
  <div id="title">THE INTERNET</div>
  <div id="subtitle">but everything is uppercase</div>

  <div id="browser-window">
    <canvas id="browser-canvas"></canvas>

    <div id="toolbar">
      <button class="nav-btn" id="back-btn" title="Back">&larr;</button>
      <button class="nav-btn" id="fwd-btn" title="Forward">&rarr;</button>
      <input id="url-input" type="text" placeholder="type a url... like wikipedia.org" spellcheck="false" autocomplete="off">
      <button id="go-btn">GO!</button>
    </div>

    <div id="iframe-container">
      <div id="splash">
        <div class="arrow">&uarr;</div>
        <h2>TYPE A URL AND PRESS GO</h2>
        <p>every website, but UPPERCASE</p>
      </div>
      <iframe id="content-frame" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
    </div>
  </div>

  <script>
    const canvas = document.getElementById('browser-canvas');
    const browserWindow = document.getElementById('browser-window');
    const urlInput = document.getElementById('url-input');
    const goBtn = document.getElementById('go-btn');
    const backBtn = document.getElementById('back-btn');
    const fwdBtn = document.getElementById('fwd-btn');
    const frame = document.getElementById('content-frame');
    const splash = document.getElementById('splash');

    function drawChrome() {
      const rect = browserWindow.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      const rc = rough.canvas(canvas);
      const w = rect.width;
      const h = rect.height;

      // outer browser window
      rc.rectangle(2, 2, w - 4, h - 4, {
        roughness: 2.5, strokeWidth: 2.5, stroke: '#333', bowing: 2
      });

      // toolbar separator line
      rc.line(4, 56, w - 4, 57, {
        roughness: 1.5, strokeWidth: 1.5, stroke: '#999'
      });

      // url bar background
      const inputRect = urlInput.getBoundingClientRect();
      const bwRect = browserWindow.getBoundingClientRect();
      const inputX = inputRect.left - bwRect.left;
      const inputY = inputRect.top - bwRect.top;
      rc.rectangle(inputX - 4, inputY - 3, inputRect.width + 8, inputRect.height + 6, {
        roughness: 1.8, strokeWidth: 1.5, stroke: '#aaa', fill: 'rgba(255,255,255,0.5)',
        fillStyle: 'solid', bowing: 1.5
      });

      // iframe border
      const frameContainer = document.getElementById('iframe-container');
      const frameRect = frameContainer.getBoundingClientRect();
      const fx = frameRect.left - bwRect.left;
      const fy = frameRect.top - bwRect.top;
      rc.rectangle(fx - 1, fy - 1, frameRect.width + 2, frameRect.height + 2, {
        roughness: 1.5, strokeWidth: 1.5, stroke: '#999', bowing: 1
      });
    }

    function navigate(url) {
      if (!url) return;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      splash.style.display = 'none';
      frame.src = '/browse/' + url;
      urlInput.value = url;
    }

    goBtn.addEventListener('click', () => navigate(urlInput.value.trim()));
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') navigate(urlInput.value.trim());
    });
    backBtn.addEventListener('click', () => {
      try { frame.contentWindow.history.back(); } catch(e) {}
    });
    fwdBtn.addEventListener('click', () => {
      try { frame.contentWindow.history.forward(); } catch(e) {}
    });

    // listen for navigation messages from proxied pages
    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'navigate' && e.data.url) {
        urlInput.value = e.data.url;
      }
    });

    // update URL bar on iframe full-page navigations (back/forward across pages)
    frame.addEventListener('load', () => {
      try {
        const path = frame.contentWindow.location.pathname;
        const prefix = '/browse/';
        if (path.startsWith(prefix)) {
          const search = frame.contentWindow.location.search || '';
          const hash = frame.contentWindow.location.hash || '';
          urlInput.value = path.slice(prefix.length) + search + hash;
        }
      } catch(e) {}
    });

    // draw on load and resize
    window.addEventListener('load', drawChrome);
    window.addEventListener('resize', drawChrome);
    requestAnimationFrame(drawChrome);
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
