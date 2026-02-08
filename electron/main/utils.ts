import { app } from 'electron'
import path from 'node:path'

export const normalizeHtml = (input: string) => input.replace(/\u00a0/g, '&nbsp;')

/** 如果 filePath 已存在，自动追加 (副本N) 后缀 */
export const ensureUniquePath = async (filePath: string): Promise<string> => {
  const fs = await import('node:fs/promises')
  const pathMod = await import('node:path')
  let candidate = filePath
  let i = 1
  const dir = pathMod.dirname(filePath)
  const ext = pathMod.extname(filePath)
  const base = pathMod.basename(filePath, ext)
  while (true) {
    try {
      await fs.access(candidate)
      candidate = pathMod.join(dir, `${base}(副本${i})${ext}`)
      i++
    } catch {
      return candidate
    }
  }
}

export const extractInlineStyles = (input: string) => {
  const styles: string[] = []
  const body = input.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_match, css) => {
    if (css) styles.push(css)
    return ''
  })
  return { body, styles: styles.join('\n') }
}

export const readCkeditorCss = async () => {
  try {
    const fs = await import('node:fs/promises')
    const cssPath = path.join(app.getAppPath(), 'node_modules', 'ckeditor5', 'ckeditor5.css')
    return await fs.readFile(cssPath, 'utf8')
  } catch {
    return ''
  }
}
