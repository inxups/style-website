# style-website

English | [简体中文](README.zh_CN.md)

The website and documentation for STYLE, built with React and Vite and deployed to GitHub Pages at <https://style.pixulse.com/>.

## About

STYLE is a hooks framework that tunes the behavior of harnesses such as Claude Code and Codex with a few lines of rules; the CLI lives in [inxups/style-cli](https://github.com/inxups/style-cli). This repository contains only its website: a landing page that introduces STYLE, and a set of documentation pages generated from the Markdown under `docs/`. Markdown is the single source of truth, so reading the docs on GitHub and browsing them on the site shows the same content.

## Quick Start

### Prerequisites

- Node.js 22 (the version used in CI)
- npm

### Installation

```bash
npm ci
```

### Usage

```bash
npm run dev
```

The site is configured with `base: '/'` for its custom domain, so once the server is up, open <http://localhost:5173/>. The docs are at <http://localhost:5173/docs/>.

## Features

- **Landing page**: draggable rule stickers, sample rules (`warn` / `block` / `inject`) and a one-click copy of the install command
- **Docs site**: reads `docs/style-yaml/*.md` and splits it into separate pages by layer (basics, package fields, rules, native hooks, commands and diagnostics), each served at `docs/<slug>/`
- **Link rewriting**: relative `.md` links between Markdown pages are rewritten into anchors on the matching layer page
- **Light / dark theme**: follows the system by default, remembers a manual choice in `localStorage`, and applies it before first paint so there is no flash
- **Automatic deployment**: every push to `main` is built by GitHub Actions and published to GitHub Pages

## Project Structure

```text
.
├── index.html              Landing page entry
├── docs/
│   ├── index.html          Docs site entry (shared by all layers)
│   ├── README.md           Docs index table; sets the page order
│   ├── _template.md        Docs page template
│   └── style-yaml/         Docs content, one page per group of keys
├── src/
│   ├── Home.jsx            Landing page
│   ├── sections.jsx        Landing page intro section and footer
│   ├── Docs.jsx            Docs page rendering
│   ├── docs-content.js     Parses Markdown, assigns anchors, rewrites links
│   ├── docs-layers.js      Docs layer definitions (also read by the Vite config)
│   └── shared.js           Shared constants such as the repo URL and install command
├── public/                 Static assets
├── vite.config.js          Build config, including the plugin that generates a page per layer
└── .github/workflows/      GitHub Pages deployment workflow
```

## Development

```bash
npm run build     # Build into dist/ and copy docs/<slug>/index.html for each docs layer
npm run preview   # Preview the build locally
```

There are no test or lint scripts yet.

To add a docs page:

1. Copy `docs/_template.md` to `docs/style-yaml/<name>.md` and fill it in, following the conventions in [docs/README.md](docs/README.md)
2. Register the page in the index table in `docs/README.md`; the table order is the page order on the site
3. Add the page to a layer's `pages` in `src/docs-layers.js`; pages not assigned to any layer are placed in the last layer automatically

## FAQ

**The custom domain shows a blank page after configuring DNS and GitHub Pages?**
Check that `base` in `vite.config.js` is `'/'`, then rebuild and deploy. The old `'/style-website/'` base makes the page request assets under a nonexistent repository path on the custom domain.

**After adding a layer, visiting `docs/<slug>/` directly returns 404?**
Layer URLs come from the `slug` values in `src/docs-layers.js`. In development a Vite middleware rewrites them to `docs/index.html`, and at build time a plugin copies the page for each slug; both only recognize slugs registered in that file.
