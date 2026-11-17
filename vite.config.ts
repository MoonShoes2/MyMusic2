import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    port: 5173,
    // 开发时把 /api 代理到本地 wrangler pages dev（8788），没有则走远程代理站
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://127.0.0.1:8788',
        changeOrigin: true,
      },
    },
  },
})
