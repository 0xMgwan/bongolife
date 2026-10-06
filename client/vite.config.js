import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const target = process.env.API_URL || 'http://localhost:8787';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@shared': path.resolve(__dirname, '../shared') } },
  server: {
    port: 5173,
    fs: { allow: ['..'] },
    proxy: {
      '/api': target,
      '/uploads': target,
      '/socket.io': { target, ws: true },
    },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: { manualChunks: { three: ['three', '@react-three/fiber'] } },
    },
  },
});
