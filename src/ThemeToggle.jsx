import { useState } from 'react'

// 首次加载时由 index.html 里的内联脚本设好 data-theme（用户选过的优先，否则跟随系统），这里只负责切换和记住
const KEY = 'style-theme'

// 线条图标，线宽和圆角端点与 LogoIcon 一致
const Sun = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </svg>
)

const Moon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
  </svg>
)

const OPTIONS = [
  { value: 'light', icon: <Sun />, label: '亮色主题' },
  { value: 'dark', icon: <Moon />, label: '暗色主题' },
]

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light')

  const pick = (value) => {
    document.documentElement.dataset.theme = value
    try { localStorage.setItem(KEY, value) } catch { /* 存储不可用时只在本页生效 */ }
    setTheme(value)
  }

  // 日、月并排显示，滑块停在当前主题上
  return (
    <div className={`sk-theme is-${theme}`} role="group" aria-label="主题">
      <span className="sk-theme-thumb" aria-hidden="true" />
      {OPTIONS.map((o) => (
        <button key={o.value} aria-label={o.label} title={o.label} aria-pressed={theme === o.value} onClick={() => pick(o.value)}>
          {o.icon}
        </button>
      ))}
    </div>
  )
}
