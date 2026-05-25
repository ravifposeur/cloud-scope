import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // All /api/* calls → Nginx (which forwards to FastAPI at port 8000)
      // When Docker is running: Nginx sits at port 80
      // For local dev without Docker: change target to 'http://localhost:8000'
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
