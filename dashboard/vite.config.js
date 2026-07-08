/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    proxy: {
      '/supabase': {
        target: 'https://gwen-supa-rinjani.digi46.id',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/supabase/, ''),
      }
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
