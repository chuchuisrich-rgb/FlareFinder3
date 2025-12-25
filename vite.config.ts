
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Fix for __dirname in ESM environment
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.API_KEY),
        'process.env.WORKER_VERSION': JSON.stringify(env.WORKER_VERSION),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        target: 'esnext' // Resolves the "Top-level await is not available" error
      },
      esbuild: {
        target: 'esnext'
      },
      optimizeDeps: {
        esbuildOptions: {
          target: 'esnext'
        }
      }
    };
});
