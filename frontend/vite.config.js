import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// En développement, /api et /media sont redirigés vers Django (aucun souci de CORS).
// Pour pointer vers un autre serveur : VITE_PROXY_TARGET=https://api.exemple.com
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000';
  return {
    plugins: [react()],
    server: { proxy: { '/api': target, '/media': target } },
    test: { environment: 'jsdom', globals: true, setupFiles: './src/test/setup.js', css: false },
  };
});
