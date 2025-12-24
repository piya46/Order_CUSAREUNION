// vite.config.js
import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default ({ mode }) => {
  const env   = loadEnv(mode, process.cwd(), '');
  const isDev = mode === 'development';

  // ⭐️ ใช้ base จาก ENV (เช่น deploy ใต้ซับพาธ) ไม่ตั้ง = '/'
  const base = env.VITE_BASE_PATH || '/';

  // ⭐️ Dev เท่านั้น: รองรับ https ถ้ามีไฟล์ cert ในโปรเจกต์
  const httpsOption = (() => {
    if (!isDev) return undefined;
    const keyPath  = path.resolve('./localhost+2-key.pem');
    const certPath = path.resolve('./localhost+2.pem');
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
    }
    return undefined;
  })();

  // ⭐️ Dev เท่านั้น: proxy ไป backend (prod จะไม่ใช้ proxy)
  const devApi = env.VITE_DEV_API || 'http://localhost:3000';

  return defineConfig({
    base,
    plugins: [react()],

    /* ========= DEV ========= */
    server: isDev
      ? {
          host: true,
          port: Number(env.VITE_PORT || 5173),
          https: httpsOption,
          proxy: {
            '/api':            { target: devApi, changeOrigin: true, secure: false, ws: true },
            '/public_uploads': { target: devApi, changeOrigin: true, secure: false, ws: true },
          },
        }
      : undefined,

    /* ========= PROD BUILD ========= */
    build: {
      outDir: 'dist',
      sourcemap: false,
      emptyOutDir: true,
      target: 'es2018',
      cssTarget: 'chrome61',
      chunkSizeWarningLimit: 900, // ลด warning เวลาแยกชิ้นส่วนใหญ่
      rollupOptions: {
        output: {
          // แยก vendor เพื่อ cache ดีขึ้น
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            mui: ['@mui/material', '@mui/icons-material'],
          },
        },
      },
    },

    // สำหรับ preview ทดสอบหลัง build (ไม่ใช่ production server จริง)
    preview: {
      port: 4173,
      https: false,
    },

    // ใส่ตัวแปรช่วยดีบั๊กใน runtime ได้หากต้องการ
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || ''),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
  });
};