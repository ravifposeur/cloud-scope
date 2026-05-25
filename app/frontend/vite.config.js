import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,          // always lock to 5173
    strictPort: true,    // fail loudly if port is taken instead of silently shifting
    proxy: {
      // All /api/* calls → Nginx (which forwards to FastAPI at port 8000)
      // When Docker is running: Nginx sits at port 80
      // For local dev without Docker: change target to 'http://localhost:8000'
      //   and also set rewrite to remove the /api prefix (FastAPI uses root_path="/api")
      '/api': {
        target: 'http://localhost:80',
        changeOrigin: true,
        // If Docker is NOT running and you're running FastAPI directly on 8000,
        // uncomment the two lines below and set target to http://localhost:8000:
        // target: 'http://localhost:8000',
        // rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
