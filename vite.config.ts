import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: '/',

  plugins: [react(), tailwindcss()],

  server: {
    // Dev only: proxy /cms → test API server để tránh CORS khi chạy local
    proxy: mode === 'development' ? {
      '/cms': {
        target: 'http://42.113.122.119:7080',
        changeOrigin: true,
      },
    } : undefined,
  },
}))
