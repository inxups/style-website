import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves this repo at https://inxups.github.io/style-website/
export default defineConfig({
  plugins: [react()],
  base: '/style-website/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        docs: resolve(import.meta.dirname, 'docs/index.html'),
      },
    },
  },
})
