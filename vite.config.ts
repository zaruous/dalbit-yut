import {defineConfig} from 'vite';
const allowedHosts = ['unquieted-nonprudently-dione.ngrok-free.dev'];
const proxy = {
  '/api/laya': {
    target: 'http://localhost:3005',
    changeOrigin: true,
  },
};
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/dalbit-yut/' : '/',
  server: {
    host: '0.0.0.0',
    allowedHosts,
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/laya-data/**', '**/.venv-laya/**'],
    },
    proxy,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts,
    port: 4173,
    strictPort: true,
    proxy,
  },
});
