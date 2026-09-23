import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@devpromax/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `monaco-vim` is UMD and requires the pre-0.56 spelling, which Monaco's
      // exports map now resolves to `esm/vs/esm/vs/...`. See src/editor/monaco.ts.
      'monaco-editor/esm/vs/editor/editor.api': 'monaco-editor/editor/editor.api.js',
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        // Follows the API's own port setting, so a second API on another port
        // (the e2e suite's, beside a dev server already on 5174) is reachable.
        target: `http://127.0.0.1:${process.env['DEVPROMAX_PORT'] ?? '5174'}`,
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
