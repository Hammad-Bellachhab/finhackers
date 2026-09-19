import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // El front llama a /api/... y Vite lo reenvia al backend en desarrollo.
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
