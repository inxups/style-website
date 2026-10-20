# style-website

[English](README.md) | 简体中文

STYLE 的官网与文档站，使用 React 和 Vite 构建，部署在 GitHub Pages：<https://style.pixulse.com/>。

## 快速介绍

STYLE 是一个用几行规则调整 Claude Code、Codex 等 harness 行为的 Hooks 框架，命令行工具在 [inxups/style-cli](https://github.com/inxups/style-cli)。本仓库只包含它的网站：一个介绍 STYLE 的首页，以及一套由 `docs/` 下 Markdown 生成的文档页面。文档内容以 Markdown 为唯一来源，在 GitHub 上直接阅读和在网站上浏览看到的是同一份内容。

## 快速开始

### 环境要求

- Node.js 22（与 CI 使用的版本一致）
- npm

### 安装

```bash
npm ci
```

### 运行

```bash
npm run dev
```

站点为自定义域名配置了 `base: '/'`，启动后请打开 <http://localhost:5173/>，文档在 <http://localhost:5173/docs/>。

## 主要功能

- **首页**：可拖动的规则贴纸、示例规则（`warn` / `block` / `inject`）和一键复制安装命令
- **Agent skill**：介绍 [inxups/inxv-skills](https://github.com/inxups/inxv-skills) 里的 `style-creator` 和 `style-installer`，提供 Claude Code 与 Codex 的一键复制安装命令
- **文档站**：读取 `docs/style-yaml/*.md`，按层（基础、包级字段、规则、原生 hook、命令与诊断）分成独立页面，每层地址为 `docs/<slug>/`
- **站内链接改写**：Markdown 中页面之间的 `.md` 相对链接会自动改成对应层页面上的锚点
- **亮色 / 暗色主题**：默认跟随系统，手动切换后记在 `localStorage`，首屏渲染前就设好，不会闪烁
- **自动部署**：推送到 `main` 后由 GitHub Actions 构建并发布到 GitHub Pages

## 项目结构

```text
.
├── index.html              首页入口
├── docs/
│   ├── index.html          文档站入口（所有层共用）
│   ├── README.md           文档目录表，决定页面顺序
│   ├── _template.md        文档页面模板
│   └── style-yaml/         文档正文，每个关键字组一页
├── src/
│   ├── Home.jsx            首页
│   ├── sections.jsx        首页的介绍区和页脚
│   ├── Docs.jsx            文档页渲染
│   ├── docs-content.js     解析 Markdown、分配锚点、改写链接
│   ├── docs-layers.js      文档分层定义（Vite 配置也会读取）
│   └── shared.js           仓库地址、安装命令等共用常量
├── public/                 静态资源
├── vite.config.js          构建配置，含为每层生成页面的插件
└── .github/workflows/      GitHub Pages 部署流程
```

## 开发与测试

```bash
npm run build     # 构建到 dist/，并为每层文档复制一份 docs/<slug>/index.html
npm run preview   # 本地预览构建结果
```

项目目前没有测试和 lint 脚本。

新增文档页面：

1. 复制 `docs/_template.md` 到 `docs/style-yaml/<name>.md` 并填写内容，写作约定见 [docs/README.md](docs/README.md)
2. 在 `docs/README.md` 的目录表中登记该页面，表中顺序就是站点上的页面顺序
3. 在 `src/docs-layers.js` 中把页面加入某一层的 `pages`；没有加入任何层的页面会自动放进最后一层

## 常见问题

**DNS 和 GitHub Pages 配好后，自定义域名打开仍是空白？**
检查 `vite.config.js` 中的 `base` 是否为 `'/'`，然后重新构建部署。旧的 `'/style-website/'` 会让页面从自定义域名下不存在的仓库路径加载资源。

**新增一层后，直接访问 `docs/<slug>/` 返回 404？**
层的地址来自 `src/docs-layers.js` 中的 `slug`。开发时由 Vite 中间件改写到 `docs/index.html`，构建时由插件为每个 slug 复制一份页面，两者都只认这个文件里登记过的 slug。

## 许可证

[MIT](LICENSE)
