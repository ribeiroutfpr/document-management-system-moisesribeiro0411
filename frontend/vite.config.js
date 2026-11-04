import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const proxySecret = process.env.DMS_PROXY_SHARED_SECRET;
const developmentUser = process.env.DMS_DEV_USER ?? 'local-user';

// Configuração mínima do Vite. O proxy direciona chamadas /api para o backend
// local durante o desenvolvimento (Passo 3 e Passo 4 - integração).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure(proxy) {
          proxy.on('proxyReq', (proxyRequest) => {
            if (proxySecret) {
              proxyRequest.setHeader('x-dms-proxy-secret', proxySecret);
              proxyRequest.setHeader('x-authenticated-user', developmentUser);
            } else {
              proxyRequest.removeHeader('x-dms-proxy-secret');
              proxyRequest.removeHeader('x-authenticated-user');
            }
          });
        },
      },
    },
  },
});
