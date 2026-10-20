// 文档分层：每层是一个独立页面，地址为 docs/<slug>/，pages 是 docs/style-yaml/ 下的文件名（按显示顺序）。
// vite.config.js 也读这里的 slug 来生成各层页面，所以这个文件不能依赖 Vite 专有的 import。
export const LAYERS = [
  {
    slug: 'basics',
    title: '基础',
    desc: '包有哪几种形态、style 读取包时做了什么，以及从编写、校验到隔离测试的完整流程。',
    pages: ['overview', 'authoring'],
  },
  {
    slug: 'package',
    title: '包级字段',
    desc: '写在 STYLE.yaml 顶层、作用于整个包的字段：元数据、依赖与设置、token 预算和默认值。',
    pages: ['package', 'requires', 'budget', 'defaults'],
  },
  {
    slug: 'rules',
    title: '规则',
    desc: '一条规则的全部字段：正文来源、作用对象、动作与时机、条件匹配，以及落点不可用时的降级。',
    pages: ['rules', 'target', 'action', 'when', 'fallback'],
  },
  {
    slug: 'hooks',
    title: '原生 hook',
    desc: '不经过规则引擎、直接注册到 harness 的原生 hook 声明。',
    pages: ['native-hooks'],
  },
  {
    slug: 'reference',
    title: '命令与诊断',
    desc: 'style 命令行的全部命令、参数和退出码，以及校验和安装时会报的诊断码。',
    pages: ['cli', 'diagnostics'],
  },
]
