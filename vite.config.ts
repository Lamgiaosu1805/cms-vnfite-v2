import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // env có thể dùng sau khi cần inject VITE_* vars vào build
  loadEnv(mode, process.cwd(), '')

  return {
    // base: '/admin' khi build (test/prod) để serve từ /admin path trên nginx
    // base: '/'   khi dev (local) để Vite dev server hoạt động bình thường
    base: mode === 'development' ? '/' : '/admin/',

    plugins: [react(), tailwindcss()],

    server: {
      // Dev only: proxy /cms → test server để tránh CORS
      proxy: {
        '/cms': {
          target: 'http://42.113.122.119:7080',
          changeOrigin: true,
        },
      },
    },
  }
})
