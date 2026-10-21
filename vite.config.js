import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { LAYERS } from './src/docs-layers.js'

// The custom domain serves this site at https://style.pixulse.com/.
const BASE = '/'

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

// 给 agent 读的纯文本版本：文档页面是前端渲染的，抓取工具拿不到正文。
// docs/style-yaml/*.md 原样发布到同一路径，llms.txt 按分层列出每页的 Markdown 地址
const SITE = 'https://style.pixulse.com'
const MD_DIR = 'docs/style-yaml'

function llmsTxt(root) {
  const lines = [
    '# STYLE',
    '',
    '> STYLE 文档：包的形态、包级字段、规则、原生 hook、命令行和诊断码。下面每个链接都是一页 Markdown 原文。',
    '',
  ]
  for (const layer of LAYERS) {
    lines.push(`## ${layer.title}`, '', layer.desc, '')
    for (const page of layer.pages) {
      const src = readFileSync(resolve(root, MD_DIR, `${page}.md`), 'utf8')
      const title = src.match(/^# (.+)$/m)?.[1] ?? page
      const lead = src.match(/^# .+\n+> (.+)$/m)?.[1]
      lines.push(`- [${title}](${SITE}${BASE}${MD_DIR}/${page}.md)${lead ? `: ${lead}` : ''}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

function docsMarkdown() {
  let root = '.'
  let outDir = 'dist'
  return {
    name: 'docs-markdown',
    configResolved(config) {
      root = config.root
      outDir = resolve(config.root, config.build.outDir)
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url.split('?')[0] !== `${BASE}llms.txt`) return next()
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end(llmsTxt(root))
      })
    },
    writeBundle() {
      mkdirSync(resolve(outDir, MD_DIR), { recursive: true })
      for (const file of readdirSync(resolve(root, MD_DIR))) {
        if (file.endsWith('.md') && !file.startsWith('_')) {
          copyFileSync(resolve(root, MD_DIR, file), resolve(outDir, MD_DIR, file))
        }
      }
      writeFileSync(resolve(outDir, 'llms.txt'), llmsTxt(root))
    },
  }
}

export default defineConfig({
  plugins: [react(), docsLayerPages(), docsMarkdown()],
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
