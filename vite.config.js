import { copyFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { LAYERS } from './src/docs-layers.js'

// GitHub Pages serves this repo at https://inxups.github.io/style-website/
const BASE = '/style-website/'

// 文档每一层都有自己的地址（docs/<slug>/），共用 docs/index.html：
// 开发时把这些地址改写到 docs/index.html，构建后给每层复制一份，GitHub Pages 直接访问或刷新都不会 404
function docsLayerPages() {
  const slugs = LAYERS.map((l) => l.slug)
  const route = new RegExp(`^${BASE}docs/([\\w-]+)/?$`)
  let outDir = 'dist'
  return {
    name: 'docs-layer-pages',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const [path, query] = req.url.split('?')
        const m = path.match(route)
        if (m && slugs.includes(m[1])) req.url = `${BASE}docs/index.html${query ? `?${query}` : ''}`
        next()
      })
    },
    writeBundle() {
      for (const slug of slugs) {
        mkdirSync(resolve(outDir, 'docs', slug), { recursive: true })
        copyFileSync(resolve(outDir, 'docs/index.html'), resolve(outDir, 'docs', slug, 'index.html'))
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), docsLayerPages()],
  base: BASE,
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        docs: resolve(import.meta.dirname, 'docs/index.html'),
      },
    },
  },
})
