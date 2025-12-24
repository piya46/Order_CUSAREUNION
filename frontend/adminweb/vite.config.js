import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devApi = env.VITE_DEV_API || 'http://localhost:3000';
  const useHttps = env.VITE_HTTPS === 'true';

  return defineConfig({
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(env.VITE_APP_VERSION || ''),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
    server: {
      host: true,
      port: 5173,
      https: useHttps
        ? {
            key: fs.readFileSync('./certs/localhost-key.pem'),
            cert: fs.readFileSync('./certs/localhost.pem'),
          }
        : false,
      proxy: {
        '/api': { target: devApi, changeOrigin: true, secure: false },
        '/public_uploads': { target: devApi, changeOrigin: true, secure: false }
      }
    },
    build: { outDir: 'dist', sourcemap: false, emptyOutDir: true }
  });
};