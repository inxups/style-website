import { marked } from 'marked'
import README from '../docs/README.md?raw'
import { LAYERS as LAYER_DEFS } from './docs-layers.js'

// docs/style-yaml/*.md 是唯一的内容来源，页面顺序按 README 目录表
const RAW = import.meta.glob('../docs/style-yaml/*.md', { query: '?raw', import: 'default', eager: true })

const slugOf = (path) => path.split('/').pop().replace(/\.md$/, '')
const listed = [...README.matchAll(/\]\(style-yaml\/([\w-]+)\.md\)/g)].map((m) => m[1])
const found = Object.keys(RAW).map(slugOf).filter((s) => !s.startsWith('_'))
const ORDER = [...new Set([...listed.filter((s) => found.includes(s)), ...found])]

// 和 GitHub 的标题锚点规则一致：小写、去标点、空格变连字符
export function anchor(text) {
  return text.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s+/g, '-')
}

// 标题的纯文本，去掉行内代码的反引号
const plain = (tokens) => tokens.map((t) => (t.tokens ? plain(t.tokens) : t.text)).join('')

function frontMatter(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n/)
  if (!m) return [{}, src]
  const meta = Object.fromEntries(
    m[1].split('\n').map((l) => l.match(/^(\w+):\s*(.*)$/)).filter(Boolean).map(([, k, v]) => [k, v]),
  )
  return [meta, src.slice(m[0].length)]
}

function parsePage(slug) {
  const [meta, body] = frontMatter(RAW[`../docs/style-yaml/${slug}.md`])
  const tokens = marked.lexer(body.replace(/<!--[\s\S]*?-->\n?/g, '')).filter((t) => t.type !== 'space')

  const h1 = tokens.findIndex((t) => t.type === 'heading' && t.depth === 1)
  const title = h1 >= 0 ? plain(tokens[h1].tokens) : meta.title || slug
  let rest = tokens.slice(h1 + 1)
  const lead = rest[0]?.type === 'blockquote' ? rest.shift().tokens : null

  // 给标题分配页内唯一的 id，并记下字段和目录项
  const used = new Set()
  const fields = []
  const sections = []
  let h2 = ''
  for (const t of rest) {
    if (t.type !== 'heading') continue
    const text = plain(t.tokens)
    let id = `${slug}--${anchor(text)}`
    for (let n = 2; used.has(id); n++) id = `${slug}--${anchor(text)}-${n}`
    used.add(id)
    t.id = id
    if (t.depth === 2) h2 = text
    if (t.depth === 3 && h2 === '字段') {
      t.field = true
      fields.push([id, text])
    } else if (t.depth === 3 && h2 !== '示例') {
      sections.push([id, text])
    }
  }

  const [short, ...more] = title.split(/[：:]/).map((x) => x.trim())
  return { slug, title, short, sub: more.join('：'), lead, tokens: rest, fields, toc: fields.length ? fields : sections }
}

export const PAGES = ORDER.map(parsePage)

export const DOCS_HOME = `${import.meta.env.BASE_URL}docs/`
export const layerUrl = (slug) => `${DOCS_HOME}${slug}/`

// 按层分组；没分到任何层的新页面放进最后一层，避免页面从站点上消失
const bySlug = Object.fromEntries(PAGES.map((p) => [p.slug, p]))
const placed = new Set(LAYER_DEFS.flatMap((l) => l.pages))
const unplaced = ORDER.filter((s) => !placed.has(s))
export const LAYERS = LAYER_DEFS.map((l, i) => ({
  ...l,
  pages: [...l.pages, ...(i === LAYER_DEFS.length - 1 ? unplaced : [])].filter((s) => bySlug[s]).map((s) => bySlug[s]),
}))
const layerOf = Object.fromEntries(LAYERS.flatMap((l) => l.pages.map((p) => [p.slug, l.slug])))

// 页面之间的 .md 链接改成对应层页面上的锚点
export function resolveHref(href) {
  const m = href.match(/^(?:\.\/)?(?:style-yaml\/)?([\w-]+)\.md(?:#(.*))?$/)
  if (!m || !layerOf[m[1]]) return href
  const id = m[2] ? `${m[1]}--${anchor(decodeURIComponent(m[2]))}` : m[1]
  return `${layerUrl(layerOf[m[1]])}#${id}`
}
