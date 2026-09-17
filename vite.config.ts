import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      {
        name: 'suppress-hmr-noise',
        transformIndexHtml: {
          order: 'post',
          handler(html) {
            const script = `<script>
(() => {
  // 1. Intercept all console methods before any client scripts run
  const methods = ['error', 'warn', 'log', 'info', 'debug'];
  for (const m of methods) {
    const orig = console[m];
    console[m] = function(...args) {
      if (args.some(a => {
        if (!a) return false;
        const str = typeof a === 'string' ? a : (a.message || a.stack || String(a));
        return str.includes('[vite]') || str.includes('websocket') || str.includes('WebSocket');
      })) {
        return;
      }
      return orig.apply(console, args);
    };
  }

  // 2. Prevent global window errors and unhandled rejections related to vite/websocket
  window.addEventListener('error', (event) => {
    if (event.message && (event.message.includes('[vite]') || event.message.includes('websocket') || event.message.includes('WebSocket'))) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason ? (typeof reason === 'string' ? reason : reason.message || '') : '';
    if (msg.includes('[vite]') || msg.includes('websocket') || msg.includes('WebSocket')) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  }, true);

  // 3. Mock WebSocket for HMR so browser never fails to connect or logs net::ERR_CONNECTION_REFUSED
  const OrigWS = window.WebSocket;
  if (OrigWS) {
    window.WebSocket = function(url, protocols) {
      const urlStr = String(url);
      if (protocols === 'vite-hmr' || protocols === 'vite-ping' || urlStr.includes('vite') || urlStr.includes('token=')) {
        const listeners = {};
        const fakeWs = {
          url: urlStr,
          readyState: 1,
          OPEN: 1,
          CLOSED: 3,
          CONNECTING: 0,
          CLOSING: 2,
          binaryType: 'blob',
          bufferedAmount: 0,
          extensions: '',
          protocol: protocols || '',
          onopen: null,
          onclose: null,
          onerror: null,
          onmessage: null,
          send: () => {},
          close: () => {},
          addEventListener: (event, cb) => {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(cb);
            if (event === 'open') {
              setTimeout(() => {
                const ev = { type: 'open', target: fakeWs };
                if (typeof fakeWs.onopen === 'function') fakeWs.onopen(ev);
                cb(ev);
              }, 0);
            }
          },
          removeEventListener: (event, cb) => {
            if (listeners[event]) {
              listeners[event] = listeners[event].filter(fn => fn !== cb);
            }
          },
          dispatchEvent: () => true,
        };
        try {
          Object.setPrototypeOf(fakeWs, OrigWS.prototype);
        } catch (_) {}
        return fakeWs;
      };
      return new OrigWS(url, protocols);
    };
    window.WebSocket.CONNECTING = 0;
    window.WebSocket.OPEN = 1;
    window.WebSocket.CLOSING = 2;
    window.WebSocket.CLOSED = 3;
    window.WebSocket.prototype = OrigWS.prototype;
  }
})();
</script>`;
            if (html.includes('/@vite/client')) {
              return html.replace(/<script type="module" src="\/@vite\/client"><\/script>/, `${script}<script type="module" src="/@vite/client"></script>`);
            }
            return script + html;
          },
        },
      },
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg', 'manifest.json'],
        manifest: {
          id: '/',
          name: 'PrintFlow - Printing Press Management Suite',
          short_name: 'PrintFlow',
          description: 'Production-ready cloud SaaS platform for printing press owners, digital counter queues, and customer print orders.',
          theme_color: '#7c3aed',
          background_color: '#0f172a',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: false,
      watch: null,
    },
  };
});
