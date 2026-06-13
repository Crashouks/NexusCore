import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function createProxy(target, httpsMode) {
  const opts = {
    target,
    changeOrigin: true,
    secure: false,
  };
  if (httpsMode) {
    opts.configure = (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.setHeader('X-Forwarded-Proto', 'https');
      });
    };
  }
  return opts;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const networkHost = env.VITE_DEV_HOST === '0.0.0.0' || env.NETWORK_MODE === '1';
  const httpsMode = env.HTTPS_MODE === '1'
    || env.VITE_HTTPS_MODE === '1'
    || (env.PUBLIC_WEB_URL || env.VITE_PUBLIC_WEB_URL || '').startsWith('https://');
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://127.0.0.1:5000';
  const apiProxy = createProxy(proxyTarget, httpsMode);

  return {
    plugins: [react()],
    server: {
      host: networkHost ? '0.0.0.0' : undefined,
      port: parseInt(env.VITE_DEV_PORT || '5173', 10),
      allowedHosts: networkHost ? true : undefined,
      proxy: {
        '/api': apiProxy,
        '/uploads': apiProxy,
        '/hubs': { ...apiProxy, ws: true },
      },
    },
  };
});
