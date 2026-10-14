// 钩环图标：生命周期环末端带钩，钩住中心的 agent
export default function LogoIcon({ size = 28 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M15.5 5.94A7 7 0 1 1 8.5 5.94l.7 2.6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
    </svg>
  )
}
