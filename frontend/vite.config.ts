import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  // En local, /api lo sirve `npx wrangler dev` (puerto 8787) con la key en .dev.vars.
  server: { port: 5173, proxy: { '/api': 'http://localhost:8787' } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
