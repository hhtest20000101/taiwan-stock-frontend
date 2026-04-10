import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api/twse': {
        target: 'https://openapi.twse.com.tw',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/twse/, '')
      },
      '/api/tpex': {
        target: 'https://openapi.tpex.org.tw',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/tpex/, '')
      },
      '/api/taifex': {
        target: 'https://openapi.taifex.com.tw',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/taifex/, '')
      },
      '/api/finmind': {
        target: 'https://api.finmindtrade.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/finmind/, '')
      }
    }
  }
})
