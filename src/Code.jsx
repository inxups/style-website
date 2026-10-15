import { useCopy } from './shared.js'

// 极简语法高亮，按语言切分：注释、字符串、键名
const RULES = {
  yaml: /(^#.*$|\s#.*$|'[^']*'|"[^"]*"|^\s*(?:- )?[A-Za-z_][\w.-]*(?=:))/,
  bash: /(^#.*$|\s#.*$|'[^']*'|"[^"]*")/,
  json: /("[^"]*"\s*:|"[^"]*")/,
}

function paint(line, lang) {
  const re = RULES[lang]
  if (!re) return line
  return line.split(re).map((tok, i) => {
    if (!tok) return null
    if (i % 2 === 0) return tok
    if (/^\s*#/.test(tok)) return <span key={i} className="tk-c">{tok}</span>
    if (/^['"]/.test(tok) && !tok.endsWith(':')) return <span key={i} className="tk-s">{tok}</span>
    return <span key={i} className="tk-k">{tok}</span>
  })
}

// md 规则文件：两条 --- 之间按 yaml 高亮，之后是正文
function linesOf(src, lang) {
  if (lang !== 'md') return src.split('\n').map((l) => paint(l, lang))
  let fences = 0
  return src.split('\n').map((l) => {
    if (l === '---' && fences < 2) {
      fences += 1
      return <span className="tk-c">{l}</span>
    }
    return fences === 1 ? paint(l, 'yaml') : l
  })
}

export default function Code({ children, lang = 'text', copy = false, title }) {
  const [copied, doCopy] = useCopy()
  return (
    <div className="codebox">
      {(title || copy) && (
        <div className="codebox-bar">
          <span>{title}</span>
          {copy && <button onClick={() => doCopy(children)}>{copied ? '已复制' : '复制'}</button>}
        </div>
      )}
      <pre className="code">
        {linesOf(children, lang).map((line, i) => (
          <span className="code-line" key={i}>{line}{'\n'}</span>
        ))}
      </pre>
    </div>
  )
}
