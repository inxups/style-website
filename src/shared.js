import { useState } from 'react'

export const REPO_URL = 'https://github.com/inxups/style'
export const INSTALL_CMD = 'npx style-hooks init'

export function useCopy() {
  const [copied, setCopied] = useState(false)
  const copy = async (text = INSTALL_CMD) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* 剪贴板不可用时静默失败 */
    }
  }
  return [copied, copy]
}
