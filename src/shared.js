import { useState } from 'react'

export const REPO_URL = 'https://github.com/inxups/style-cli'
export const SKILLS_REPO_URL = 'https://github.com/inxups/inxv-skills'
export const INSTALL_CMD = 'style install ./my-style'
export const DOCS_URL = `${import.meta.env.BASE_URL}docs/`

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
